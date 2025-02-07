import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { useSnackbar } from "notistack";
import { useSettings } from "../SettingsProvider";
import { networkVersion } from "@src/utils/constants";
import { generateCertificate, getCertPem, openCert } from "@src/utils/certificateUtils";
import { Snackbar } from "@src/components/shared/Snackbar";
import { getSelectedStorageWallet, getStorageWallets, updateWallet } from "@src/utils/walletUtils";
import { useKeplr } from "../KeplrWalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { RestApiCertificatesResponseType } from "@src/types/certificate";

export type LocalCert = {
  certPem: string;
  keyPem: string;
  address: string;
};

type ChainCertificate = {
  serial: string;
  parsed: string;
  pem: {
    hSerial: string;
    sIssuer: string;
    sSubject: string;
    sNotBefore: string;
    sNotAfter: string;
    issuedOn: Date;
    expiresOn: Date;
  };
  certificate: {
    cert: string;
    pubkey: string;
    state: string;
  };
};

type ContextType = {
  loadValidCertificates: (showSnackbar?: boolean) => Promise<any>;
  selectedCertificate: ChainCertificate;
  setSelectedCertificate: React.Dispatch<ChainCertificate>;
  isLoadingCertificates: boolean;
  loadLocalCert: () => Promise<void>;
  localCert: LocalCert;
  setLocalCert: React.Dispatch<LocalCert>;
  isLocalCertMatching: boolean;
  validCertificates: Array<ChainCertificate>;
  setValidCertificates: React.Dispatch<React.SetStateAction<ChainCertificate[]>>;
  localCerts: Array<LocalCert>;
  setLocalCerts: React.Dispatch<React.SetStateAction<LocalCert[]>>;
  createCertificate: () => Promise<void>;
  isCreatingCert: boolean;
  regenerateCertificate: () => Promise<void>;
  revokeCertificate: (certificate: ChainCertificate) => Promise<void>;
  revokeAllCertificates: () => Promise<void>;
};

const CertificateProviderContext = React.createContext<Partial<ContextType>>({});

export const CertificateProvider = ({ children }) => {
  const [isCreatingCert, setIsCreatingCert] = useState(false);
  const [validCertificates, setValidCertificates] = useState<Array<ChainCertificate>>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<ChainCertificate>(null);
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(false);
  const [localCerts, setLocalCerts] = useState<Array<LocalCert>>(null);
  const [localCert, setLocalCert] = useState<LocalCert>(null);
  const [isLocalCertMatching, setIsLocalCertMatching] = useState(false);
  const { settings } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const { address, signAndBroadcastTx } = useKeplr();
  const { apiEndpoint } = settings;

  const loadValidCertificates = useCallback(
    async (showSnackbar?: boolean) => {
      setIsLoadingCertificates(true);

      try {
        const response = await axios.get<RestApiCertificatesResponseType>(
          `${apiEndpoint}/akash/cert/${networkVersion}/certificates/list?filter.state=valid&filter.owner=${address}`
        );
        const certs = (response.data.certificates || []).map(cert => {
          const parsed = atob(cert.certificate.cert);
          const pem = getCertPem(parsed);

          return {
            ...cert,
            parsed,
            pem
          };
        });

        setValidCertificates(certs);
        setIsLoadingCertificates(false);

        if (showSnackbar) {
          enqueueSnackbar(<Snackbar title="Certificate refreshed!" iconVariant="success" />, { variant: "success" });
        }

        return certs;
      } catch (error) {
        console.log(error);

        setIsLoadingCertificates(false);
        enqueueSnackbar(<Snackbar title="Error fetching certificate." iconVariant="error" />, { variant: "error" });

        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, apiEndpoint, localCert, selectedCertificate]
  );

  /**
   * When changing wallet, reset certs and load for new wallet
   */
  useEffect(() => {
    // Clear certs when no selected wallet
    setValidCertificates([]);
    setSelectedCertificate(null);
    setLocalCert(null);

    if (address) {
      loadValidCertificates();
      loadLocalCert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    let isMatching = false;
    if (validCertificates?.length > 0 && localCert) {
      let currentCert = validCertificates.find(x => x.parsed === localCert.certPem);

      if (!selectedCertificate && currentCert) {
        setSelectedCertificate(currentCert);
      } else {
        currentCert = validCertificates.find(x => x.parsed === localCert?.certPem && selectedCertificate?.serial === x.serial);
      }

      isMatching = !!currentCert;
    }

    setIsLocalCertMatching(isMatching);
  }, [selectedCertificate, localCert, validCertificates]);

  const loadLocalCert = async () => {
    // open certs for all the wallets
    const wallets = getStorageWallets();
    const currentWallet = getSelectedStorageWallet();
    const certs = [];

    for (let i = 0; i < wallets.length; i++) {
      const _wallet = wallets[i];

      const cert = await openCert(_wallet.cert, _wallet.certKey);
      const _cert = { ...cert, address: _wallet.address };

      certs.push(_cert);

      if (_wallet.address === currentWallet?.address) {
        setLocalCert(_cert);
      }
    }

    setLocalCerts(certs);
  };

  /**
   * Create certificate
   */
  async function createCertificate() {
    setIsCreatingCert(true);

    const { crtpem, pubpem, encryptedKey } = generateCertificate(address);

    try {
      const message = TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: crtpem,
            certKey: encryptedKey
          };
        });
        const validCerts = await loadValidCertificates();
        loadLocalCert();
        const currentCert = validCerts.find(x => x.parsed === crtpem);
        setSelectedCertificate(currentCert);

        event(AnalyticsEvents.CREATE_CERTIFICATE, {
          category: "certificates",
          label: "Created certificate"
        });
      }

      setIsCreatingCert(false);
    } catch (error) {
      setIsCreatingCert(false);

      throw error;
    }
  }

  /**
   * Regenerate certificate
   */
  async function regenerateCertificate() {
    setIsCreatingCert(true);
    const { crtpem, pubpem, encryptedKey } = generateCertificate(address);

    try {
      const revokeCertMsg = TransactionMessageData.getRevokeCertificateMsg(address, selectedCertificate.serial);
      const createCertMsg = TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
      const response = await signAndBroadcastTx([revokeCertMsg, createCertMsg]);
      if (response) {
        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: crtpem,
            certKey: encryptedKey
          };
        });
        const validCerts = await loadValidCertificates();
        loadLocalCert();
        const currentCert = validCerts.find(x => x.parsed === crtpem);
        setSelectedCertificate(currentCert);

        event(AnalyticsEvents.REGENERATE_CERTIFICATE, {
          category: "certificates",
          label: "Regenerated certificate"
        });
      }

      setIsCreatingCert(false);
    } catch (error) {
      setIsCreatingCert(false);
      throw error;
    }
  }

  /**
   * Revoke certificate
   */
  const revokeCertificate = async (certificate: ChainCertificate) => {
    try {
      const message = TransactionMessageData.getRevokeCertificateMsg(address, certificate.serial);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        const validCerts = await loadValidCertificates();
        const isRevokingOtherCert = validCerts.some(c => c.parsed === localCert?.certPem);
        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: isRevokingOtherCert ? wallet.cert : undefined,
            certKey: isRevokingOtherCert ? wallet.certKey : undefined
          };
        });
        if (validCerts?.length > 0 && certificate.serial === selectedCertificate?.serial) {
          setSelectedCertificate(validCerts[0]);
        } else if (validCerts?.length === 0) {
          setSelectedCertificate(null);
        }

        event(AnalyticsEvents.REVOKE_CERTIFICATE, {
          category: "certificates",
          label: "Revoked certificate"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Revoke all certificates
   */
  const revokeAllCertificates = async () => {
    try {
      const messages = validCertificates.map(cert => TransactionMessageData.getRevokeCertificateMsg(address, cert.serial));
      const response = await signAndBroadcastTx(messages);
      if (response) {
        await loadValidCertificates();

        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: undefined,
            certKey: undefined
          };
        });

        setSelectedCertificate(null);

        event(AnalyticsEvents.REVOKE_ALL_CERTIFICATE, {
          category: "certificates",
          label: "Revoked all certificates"
        });
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <CertificateProviderContext.Provider
      value={{
        loadValidCertificates,
        selectedCertificate,
        setSelectedCertificate,
        isLoadingCertificates,
        loadLocalCert,
        localCert,
        setLocalCert,
        isLocalCertMatching,
        validCertificates,
        setValidCertificates,
        localCerts,
        setLocalCerts,
        createCertificate,
        isCreatingCert,
        regenerateCertificate,
        revokeCertificate,
        revokeAllCertificates
      }}
    >
      {children}
    </CertificateProviderContext.Provider>
  );
};

export const useCertificate = () => {
  return { ...React.useContext(CertificateProviderContext) };
};

import { useState, useEffect } from "react";
import { useAkashProviders } from "../../../context/AkashProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import Layout from "@src/components/layout/Layout";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ProviderDetail } from "@src/types/provider";
import { useProviderStatus } from "@src/queries/useProvidersQuery";
import ProviderDetailLayout, { ProviderDetailTabs } from "@src/components/providers/ProviderDetailLayout";
import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  const [provider, setProvider] = useState<Partial<ProviderDetail>>(null);
  const { providers, getProviders, isLoadingProviders } = useAkashProviders();
  const { address } = useKeplr();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = useAllLeases(address, { enabled: false });
  const {
    data: providerStatus,
    isLoading: isLoadingStatus,
    refetch: getProviderStatus
  } = useProviderStatus(provider?.host_uri, {
    enabled: false,
    retry: false,
    onSuccess: _providerStatus => {
      setProvider(provider => (provider ? { ...provider, ...providerStatus } : providerStatus));
    }
  });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const providerFromList = providers?.find(d => d.owner === owner);

    if (providerFromList) {
      const numberOfDeployments = leases?.filter(d => d.provider === providerFromList.owner).length || 0;
      const numberOfActiveLeases = leases?.filter(d => d.provider === providerFromList.owner && d.state === "active").length || 0;

      setProvider({ ...providerFromList, userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases });
    } else {
      // TODO Provider not found handle display
    }
  }, [leases, providers]);

  const refresh = () => {
    getProviders();
    getLeases();
    getProviderStatus();
  };

  return (
    <Layout isLoading={isLoadingLeases || isLoadingProviders || isLoadingStatus}>
      <CustomNextSeo title={`Provider raw data for ${owner}`} url={`https://deploy.cloudmos.io${UrlService.providerDetailRaw(owner)}`} />

      <ProviderDetailLayout address={owner} page={ProviderDetailTabs.RAW} refresh={refresh} provider={provider}>
        {provider && <DynamicReactJson src={JSON.parse(JSON.stringify(provider))} collapsed={1} />}
      </ProviderDetailLayout>
    </Layout>
  );
};

export default ProviderRawPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}

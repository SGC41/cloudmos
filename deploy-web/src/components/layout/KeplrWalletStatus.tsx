import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import Box from "@mui/material/Box";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import React, { ReactNode, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import MoreVertIcon from "@mui/icons-material/MoreHoriz";
import { Chip, CircularProgress, IconButton, Menu } from "@mui/material";
import { usePopupState, bindTrigger, bindMenu } from "material-ui-popup-state/hooks";
import { CustomTooltip } from "../shared/CustomTooltip";
import { Address } from "../shared/Address";
import { PriceValue } from "../shared/PriceValue";
import { uaktToAKT } from "@src/utils/priceUtils";
import { CustomMenuItem } from "../shared/CustomMenuItem";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { GrantModal } from "../wallet/GrantModal";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  accountBalances: {
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    color: theme.palette.grey[500],
    fontWeight: "bold",
    marginLeft: ".5rem"
  }
}));

export const KeplrWalletStatus: React.FunctionComponent<Props> = ({}) => {
  const popupState = usePopupState({ variant: "popover", popupId: "keplrMenu" });
  const { classes } = useStyles();
  const { isKeplrConnected, walletName, address, walletBalances, logout, isWalletLoaded } = useKeplr();
  const [isShowingGrantModal, setIsShowingGrantModal] = useState(false);

  function onDisconnectClick() {
    popupState.close();

    logout();
  }

  const onAuthorizeSpendingClick = () => {
    popupState.close();

    setIsShowingGrantModal(true);
  };

  return (
    <>
      {isWalletLoaded ? (
        isKeplrConnected ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", paddingRight: ".5rem" }}>
              <Box sx={{ padding: "0 .5rem" }}>
                <IconButton {...bindTrigger(popupState)} size="small">
                  <MoreVertIcon />
                </IconButton>
              </Box>

              <Box sx={{ textAlign: "left", display: "flex", alignItems: "center" }}>
                <Box sx={{ fontWeight: "bold", fontSize: ".9rem", display: "flex", alignItems: "center" }}>
                  <AccountBalanceWalletIcon fontSize="small" sx={{ fontSize: "1rem" }} color="disabled" />
                  <Box sx={{ marginLeft: ".5rem", lineHeight: ".9rem", cursor: "pointer" }} component={Link} href={UrlService.address(address)}>
                    <CustomTooltip arrow title={<Address address={address} isCopyable />}>
                      <span>{walletName}</span>
                    </CustomTooltip>
                  </Box>
                </Box>

                {walletBalances && (
                  <div className={classes.accountBalances}>
                    <CustomTooltip
                      title={
                        <Box sx={{ fontSize: "1rem" }}>
                          <FormattedDecimal value={udenomToDenom(walletBalances.uakt, 2)} />
                          <Box component="span" sx={{ marginLeft: ".2rem", fontSize: ".6rem" }}>
                            AKT
                          </Box>
                        </Box>
                      }
                    >
                      <Chip label={<PriceValue value={uaktToAKT(walletBalances.uakt, 6)} />} size="small" sx={{ fontSize: ".75rem", fontWeight: "bold" }} />
                    </CustomTooltip>
                  </div>
                )}
              </Box>

              <Menu {...bindMenu(popupState)} disableScrollLock>
                <CustomMenuItem onClick={() => onAuthorizeSpendingClick()} icon={<AccountBalanceIcon fontSize="small" />} text="Authorize Spending" />
                <CustomMenuItem onClick={() => onDisconnectClick()} icon={<ExitToAppIcon fontSize="small" />} text="Disconnect Wallet" />
              </Menu>
            </Box>
          </>
        ) : (
          <ConnectWalletButton sx={{ width: { xs: "100%", sm: "100%", md: "auto" } }} />
        )
      ) : (
        <Box sx={{ padding: "0 .5rem" }}>
          <CircularProgress size={20} color="secondary" />
        </Box>
      )}

      {isShowingGrantModal && <GrantModal address={address} onClose={() => setIsShowingGrantModal(false)} />}
    </>
  );
};

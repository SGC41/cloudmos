import { useSettings } from "@src/context/SettingsProvider";
import { ApiUrlService } from "@src/utils/apiUtils";
import axios from "axios";
import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";

async function getGranterGrants(apiEndpoint: string, address: string) {
  if (!address) return null;

  const response = await axios.get(ApiUrlService.granterGrants(apiEndpoint, address));
  const filteredGrants = response.data.grants.filter(
    x =>
      x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants;
}

export function useGranterGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranterGrants(address), () => getGranterGrants(settings.apiEndpoint, address), options);
}

async function getGranteeGrants(apiEndpoint: string, address: string) {
  if (!address) return null;

  const response = await axios.get(ApiUrlService.granteeGrants(apiEndpoint, address));
  const filteredGrants = response.data.grants.filter(
    x =>
      x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
      x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
  );

  return filteredGrants;
}

export function useGranteeGrants(address: string, options = {}) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getGranteeGrants(address), () => getGranteeGrants(settings.apiEndpoint, address), options);
}

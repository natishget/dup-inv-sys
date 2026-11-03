import { CostingMethod } from './cogs';

export interface CostingMethodInfo {
  name: CostingMethod;
  displayName: string;
  description: string;
  standardsCompliance: string;
  inflationBehavior: string;
}

export interface SystemCostingMethodResponse {
  activeMethod: CostingMethod;
  activeMethodId: string;
  availableMethods: CostingMethodInfo[];
}

export interface UpdateCostingMethodResponse {
  message: string;
  previousMethod: CostingMethod;
  activeMethod: CostingMethod;
  updatedAt: string;
}


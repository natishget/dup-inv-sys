import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CostingMethodName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCostingMethodDto } from './dto/update-costing-method.dto';

export interface CostingMethodInfo {
  name: CostingMethodName;
  displayName: string;
  description: string;
  standardsCompliance: string;
  inflationBehavior: string;
}

export interface SystemCostingMethodResponse {
  activeMethod: CostingMethodName;
  activeMethodId: string;
  availableMethods: CostingMethodInfo[];
}

export interface UpdateCostingMethodResponse {
  message: string;
  previousMethod: CostingMethodName;
  activeMethod: CostingMethodName;
  updatedAt: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly methodMetadata: Record<CostingMethodName, Omit<CostingMethodInfo, 'name'>> = {
    [CostingMethodName.FIFO]: {
      displayName: 'First-In, First-Out (FIFO)',
      description:
        'Oldest inventory batches are depleted first. Balances inventory asset value closer to replacement cost.',
      standardsCompliance: 'Approved under IFRS (IAS 2) and US GAAP.',
      inflationBehavior:
        'Results in lower COGS and higher paper profit margins during periods of rising prices.',
    },
    [CostingMethodName.LIFO]: {
      displayName: 'Last-In, First-Out (LIFO)',
      description:
        'Newest inventory batches are depleted first. Matches current replacement costs directly against revenue.',
      standardsCompliance: 'Permitted under US GAAP; strictly prohibited under IFRS.',
      inflationBehavior:
        'Results in higher COGS and lower taxable income during periods of rising prices.',
    },
    [CostingMethodName.WEIGHTED_AVERAGE]: {
      displayName: 'Weighted Moving Average (AVCO)',
      description:
        'Smooths out price fluctuations by maintaining a perpetual pooled moving average unit cost per warehouse.',
      standardsCompliance: 'Approved under IFRS (IAS 2) and US GAAP.',
      inflationBehavior:
        'Blends older and newer acquisition costs, producing moderate COGS and profit stability.',
    },
  };

  /**
   * Retrieves the current active system costing method and descriptive metadata.
   * Creates default settings pointing to FIFO if no setting record exists.
   */
  async getActiveCostingMethod(): Promise<SystemCostingMethodResponse> {
    let setting = await this.prisma.systemSetting.findFirst({
      include: { costingMethod: true },
    });

    // Self-healing fallback: if no setting row exists, link to FIFO
    if (!setting) {
      let defaultMethod = await this.prisma.costingMethod.findUnique({
        where: { name: CostingMethodName.FIFO },
      });

      if (!defaultMethod) {
        defaultMethod = await this.prisma.costingMethod.create({
          data: { name: CostingMethodName.FIFO },
        });
      }

      setting = await this.prisma.systemSetting.create({
        data: { activeCostingMethodId: defaultMethod.id },
        include: { costingMethod: true },
      });
    }

    const activeMethod = setting.costingMethod?.name ?? CostingMethodName.FIFO;
    const activeMethodId = setting.activeCostingMethodId ?? '';

    const availableMethods: CostingMethodInfo[] = Object.values(CostingMethodName).map(
      (method) => ({
        name: method,
        ...this.methodMetadata[method],
      }),
    );

    return {
      activeMethod,
      activeMethodId,
      availableMethods,
    };
  }

  /**
   * Atomically updates the active costing method for the enterprise.
   * Restricted strictly to administrators.
   *
   * Audit note: Past sales and frozen cogs_entries remain permanently unchanged.
   * Only subsequent outbound sales will evaluate COGS using the new active method.
   */
  async updateActiveCostingMethod(
    dto: UpdateCostingMethodDto,
    adminUserId: string,
  ): Promise<UpdateCostingMethodResponse> {
    const targetMethod = await this.prisma.costingMethod.findUnique({
      where: { name: dto.costingMethod },
    });

    if (!targetMethod) {
      throw new NotFoundException(
        `Costing method "${dto.costingMethod}" is not registered in the system.`,
      );
    }

    const { previousMethod, activeMethod } = await this.prisma.$transaction(async (tx) => {
      let currentSetting = await tx.systemSetting.findFirst({
        include: { costingMethod: true },
      });

      const prevMethod = currentSetting?.costingMethod?.name ?? CostingMethodName.FIFO;

      if (!currentSetting) {
        currentSetting = await tx.systemSetting.create({
          data: { activeCostingMethodId: targetMethod.id },
          include: { costingMethod: true },
        });
      } else {
        await tx.systemSetting.update({
          where: { id: currentSetting.id },
          data: { activeCostingMethodId: targetMethod.id },
        });
      }

      return {
        previousMethod: prevMethod,
        activeMethod: targetMethod.name,
      };
    });

    const now = new Date().toISOString();

    // Security & Compliance Audit Log
    this.logger.log(
      `[AUDIT] Corporate Active Costing Method switched from ${previousMethod} to ${activeMethod} by Admin User UUID: ${adminUserId} at ${now}`,
    );

    return {
      message: `Active costing method successfully changed to ${activeMethod}. Future checkout transactions will apply this method. Historical records remain permanently frozen.`,
      previousMethod,
      activeMethod,
      updatedAt: now,
    };
  }
}


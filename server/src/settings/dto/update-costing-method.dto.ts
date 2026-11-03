import { IsEnum, IsNotEmpty } from 'class-validator';
import { CostingMethodName } from '@prisma/client';

export class UpdateCostingMethodDto {
  @IsNotEmpty({ message: 'Costing method is required' })
  @IsEnum(CostingMethodName, {
    message: 'Costing method must be one of: FIFO, LIFO, WEIGHTED_AVERAGE',
  })
  costingMethod: CostingMethodName;
}


import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength,
  ValidateNested, ArrayMinSize, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType } from '@prisma/client';

export class OrderItemDto {
  @ApiProperty({ example: '63965408-ce9c-4f3f-9052-906538890053' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1, { message: 'La quantité doit être au moins 1.' })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'La commande doit contenir au moins un article.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ enum: FulfillmentType, example: FulfillmentType.PICKUP })
  @IsEnum(FulfillmentType)
  fulfillment!: FulfillmentType;

  // Adresse requise uniquement si livraison
  @ApiPropertyOptional({ example: '14 rue des Oliviers, Casablanca' })
  @ValidateIf((o) => o.fulfillment === FulfillmentType.DELIVERY)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Sonnez à l’interphone.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
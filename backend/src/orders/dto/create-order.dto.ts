import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, Max, MaxLength,
  ValidateNested, ArrayMinSize, ArrayMaxSize, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType } from '@prisma/client';

export class OrderItemDto {
  @ApiProperty({ example: '63965408-ce9c-4f3f-9052-906538890053' })
  @IsUUID()
  productId!: string;

  // Le plafond n'est pas une règle commerciale — le stock, lui, est contrôlé
  // au moment de la commande. C'est une borne : sans elle, une quantité de dix
  // millions traversait la validation pour n'être refusée qu'après avoir fait
  // travailler la base.
  @ApiProperty({ example: 2, minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1, { message: 'La quantité doit être au moins 1.' })
  @Max(99, { message: 'Quantité maximale : 99 par article.' })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'La commande doit contenir au moins un article.' })
  // Le catalogue d'un institut ne compte pas cinquante références distinctes
  // dans un même panier. Sans plafond, une seule requête pouvait demander la
  // vérification de stock de dizaines de milliers de lignes.
  @ArrayMaxSize(50, { message: 'Cinquante articles différents au maximum.' })
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
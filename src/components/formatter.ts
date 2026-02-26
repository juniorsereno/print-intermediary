/**
 * Saiposprt Formatter Component
 * Converts OrderData to Saiposprt format for thermal printing
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 7.4
 */

import { v4 as uuidv4 } from 'uuid';
import type { OrderData } from '../types/models.js';
import { Logger } from '../utils/logger.js';

/**
 * Saiposprt print settings configuration
 */
export interface SaiposSettings {
  type: number;
  printDelivery: number;
  printTable: number;
  printServiceTicket: number;
  layout: number;
  rowColumns: number;
  copies: number;
  emptyLines: number;
  emptyChar: string;
  fontSize: number;
  escpos: boolean;
  idStore: number;
  guid: string;
  id_user: number;
  fileName: string;
}

/**
 * Complete Saiposprt print data structure
 */
export interface SaiposPrintData {
  printSettings: SaiposSettings;
  printRows: string[];
  sale_number: string;
  id_sale: number;
  logData: {
    id_store: number;
    id_sale: number;
    print_sent_user: number;
    print_sent_method: number;
    print_auto: string;
  };
}

/**
 * Configuration for SaiposFormatter
 */
export interface FormatterConfig {
  idStore: number;
  idUser: number;
}

/**
 * SaiposFormatter class
 * Formats order data into Saiposprt format for thermal printing
 */
export class SaiposFormatter {
  private config: FormatterConfig;
  private logger: Logger;

  constructor(config: FormatterConfig) {
    this.config = config;
    this.logger = new Logger('SaiposFormatter');
  }

  /**
   * Formats OrderData into Saiposprt format
   * @param orderData - The order data to format
   * @returns Data URL string containing base64-encoded JSON
   * 
   * Requirements: 8.1, 8.2, 8.3, 7.4
   */
  format(orderData: OrderData): string {
    return this.formatFull(orderData);
  }

  /**
   * Formats OrderData for counter print (full format with prices)
   * @param orderData - The order data to format
   * @returns Data URL string containing base64-encoded JSON
   */
  formatFull(orderData: OrderData): string {
    try {
      this.logger.info('Formatting order data (full format)', {
        orderId: orderData.id,
        itemCount: orderData.items.length
      });

      const printData: SaiposPrintData = {
        printSettings: this.generatePrintSettings(orderData.id, 'balcao'),
        printRows: this.generateFullPrintRows(orderData),
        sale_number: `do pedido ${orderData.id}`,
        id_sale: orderData.id,
        logData: {
          id_store: this.config.idStore,
          id_sale: orderData.id,
          print_sent_user: this.config.idUser,
          print_sent_method: 1,
          print_auto: 'N'
        }
      };

      const result = this.encodeToDataUrl(printData);
      this.logger.info('Order data formatted successfully (full)', {
        orderId: orderData.id,
        dataLength: result.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to format order data', error, { orderId: orderData.id });
      throw new Error('Failed to format order data for printing');
    }
  }

  /**
   * Formats OrderData for kitchen print (simplified, no prices)
   * @param orderData - The order data to format
   * @returns Data URL string containing base64-encoded JSON
   */
  formatKitchen(orderData: OrderData): string {
    try {
      this.logger.info('Formatting order data (kitchen format)', {
        orderId: orderData.id,
        itemCount: orderData.items.length
      });

      const printData: SaiposPrintData = {
        printSettings: this.generatePrintSettings(orderData.id, 'cozinha'),
        printRows: this.generateKitchenPrintRows(orderData),
        sale_number: `do pedido ${orderData.id}`,
        id_sale: orderData.id,
        logData: {
          id_store: this.config.idStore,
          id_sale: orderData.id,
          print_sent_user: this.config.idUser,
          print_sent_method: 1,
          print_auto: 'N'
        }
      };

      const result = this.encodeToDataUrl(printData);
      this.logger.info('Order data formatted successfully (kitchen)', {
        orderId: orderData.id,
        dataLength: result.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to format order data for kitchen', error, { orderId: orderData.id });
      throw new Error('Failed to format order data for kitchen printing');
    }
  }

  /**
   * Formats OrderData to both formats (counter and kitchen)
   * @param orderData - The order data to format
   * @returns Object with both formatted versions
   */
  formatBoth(orderData: OrderData): { full: string; kitchen: string } {
    return {
      full: this.formatFull(orderData),
      kitchen: this.formatKitchen(orderData)
    };
  }

  /**
   * Generates print settings for the order
   * @param orderId - The order ID
   * @param type - The print type ('balcao' or 'cozinha')
   * @returns SaiposSettings object
   * 
   * Requirements: 8.4, 8.6
   */
  private generatePrintSettings(orderId: number, type: string = 'balcao'): SaiposSettings {
    return {
      type: 0,
      printDelivery: 1,
      printTable: 1,
      printServiceTicket: 1,
      layout: 2,
      rowColumns: 42,
      copies: 1,
      emptyLines: 3,
      emptyChar: ' ',
      fontSize: 11,
      escpos: true,
      idStore: this.config.idStore,
      guid: uuidv4(),
      id_user: this.config.idUser,
      fileName: `${orderId}_${type}.saiposprt`
    };
  }

  /**
   * Generates print rows (lines) for the thermal printer - Full format (counter)
   * @param orderData - The order data
   * @returns Array of formatted print rows
   * 
   * Requirements: 8.5
   */
  private generateFullPrintRows(orderData: OrderData): string[] {
    const rows: string[] = [];

    // Barcode configuration
    rows.push('<barra_mostrar>0</barra_mostrar>');
    rows.push('<barra_largura>3</barra_largura>');
    rows.push('<barra_altura>120</barra_altura>');

    // Header section
    rows.push('</ae></linha_simples>');
    rows.push('</ce><n><e>PEDIDO</e></n>');
    rows.push(`</ae>Pedido: <n><a>#${orderData.id}</a></n>`);
    rows.push(`</ae>${orderData.customer}`);

    // Phone if provided
    if (orderData.phone) {
      rows.push(`</ae>Tel: ${orderData.phone}`);
    }

    // Address if provided
    if (orderData.address) {
      rows.push(`</ae>${orderData.address}`);
    }

    // Observation if provided
    if (orderData.observation) {
      rows.push('</ae></linha_simples>');
      rows.push(`</ae><n>OBS:</n> ${orderData.observation}`);
    }

    rows.push(`</ae>ID do pedido: ${orderData.id}`);
    rows.push('</ae></linha_simples>');

    // Items section header
    rows.push('</ae>Qt. Descrição                         Valor');
    rows.push('</ae></linha_simples>');

    // Items
    let itemsSubtotal = 0;
    for (const item of orderData.items) {
      const itemTotal = item.quantity * item.price;
      itemsSubtotal += itemTotal;
      const quantityStr = item.quantity.toString().padStart(2, ' ');
      const priceStr = itemTotal.toFixed(2).padStart(6, ' ');

      // Truncate or pad item name to fit in the available space
      const maxNameLength = 30;
      const itemName = item.name.length > maxNameLength
        ? item.name.substring(0, maxNameLength)
        : item.name.padEnd(maxNameLength, ' ');

      rows.push(`</ae><a>${quantityStr}  ${itemName} ${priceStr}</a>`);
      rows.push('</ae>');
    }

    rows.push('</ae></linha_simples>');
    rows.push(`</ae>Quantidade de itens:          <e>${orderData.items.length.toString().padStart(6, ' ')}</e>`);
    rows.push('</linha_simples>');

    // Subtotal
    const subtotalStr = itemsSubtotal.toFixed(2).padStart(6, ' ');
    rows.push(`</ae>Subtotal                            ${subtotalStr}`);

    // Delivery fee if present
    if (orderData.deliveryFee > 0) {
      const deliveryFeeStr = orderData.deliveryFee.toFixed(2).padStart(6, ' ');
      rows.push(`</ae>Taxa de Entrega                     ${deliveryFeeStr}`);
    }

    rows.push('</linha_simples>');

    // Total section
    const totalStr = orderData.total.toFixed(2).padStart(6, ' ');
    rows.push(`TOTAL(=)                            ${totalStr}`);
    rows.push('</linha_simples>');

    // Footer with barcode
    rows.push('</ce>');
    rows.push(`<code128>${orderData.id.toString().padStart(12, '0')}</code128>`);
    rows.push(`ID. do pedido: ${orderData.id}`);
    rows.push('</ae><c><n>www.saipos.com</n></c>');

    // Empty lines for paper cut
    rows.push(' ');
    rows.push(' ');
    rows.push(' ');
    rows.push('</corte_parcial>');

    return rows;
  }

  /**
   * Generates print rows (lines) for kitchen print (simplified, no prices)
   * @param orderData - The order data
   * @returns Array of formatted print rows
   */
  private generateKitchenPrintRows(orderData: OrderData): string[] {
    const rows: string[] = [];

    // Header section - SIMPLIFIED
    rows.push('</ae></linha_simples>');
    rows.push('</ce><n><e>COZINHA</e></n>');
    rows.push(`</ae>Pedido: <n><a>#${orderData.id}</a></n>`);
    rows.push(`</ae>${orderData.customer}`);

    // Phone if provided
    if (orderData.phone) {
      rows.push(`</ae>Tel: ${orderData.phone}`);
    }

    // Address if provided
    if (orderData.address) {
      rows.push(`</ae>${orderData.address}`);
    }

    // Observation if provided
    if (orderData.observation) {
      rows.push('</ae></linha_simples>');
      rows.push(`</ae><n>OBS:</n> ${orderData.observation}`);
    }

    rows.push('</ae></linha_simples>');

    // Items section header - SIMPLIFIED (no prices)
    rows.push('</ae>Itens do Pedido:');
    rows.push('</ae></linha_simples>');

    // Items - SIMPLIFIED (no prices)
    for (const item of orderData.items) {
      const quantityStr = item.quantity.toString().padStart(2, ' ');

      // Truncate or pad item name to fit in the available space
      const maxNameLength = 35;
      const itemName = item.name.length > maxNameLength
        ? item.name.substring(0, maxNameLength)
        : item.name.padEnd(maxNameLength, ' ');

      rows.push(`</ae><a>${quantityStr}x  ${itemName}</a>`);
      rows.push('</ae>');
    }

    rows.push('</ae></linha_simples>');
    rows.push(`</ae>Total de itens: ${orderData.items.length}`);
    rows.push('</linha_simples>');

    // Footer - SIMPLIFIED
    rows.push('</ce>');
    rows.push(`ID. do pedido: ${orderData.id}`);

    // Empty lines for paper cut
    rows.push(' ');
    rows.push(' ');
    rows.push(' ');
    rows.push('</corte_parcial>');

    return rows;
  }

  /**
   * Encodes print data to data URL format
   * @param data - The print data to encode
   * @returns Data URL string with base64-encoded JSON
   * 
   * Requirements: 8.1, 8.2, 8.3
   */
  private encodeToDataUrl(data: SaiposPrintData): string {
    // Wrap in array as per Saiposprt format
    const jsonString = JSON.stringify([data]);

    // Encode to base64
    const base64 = Buffer.from(jsonString, 'utf-8').toString('base64');

    // Create data URL
    return `data:text/json;charset=utf-8,${base64}`;
  }
}

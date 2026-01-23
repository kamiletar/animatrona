/**
 * @lena/zenstack-form-plugin
 *
 * ZenStack плагин для генерации Zod схем с UI метаданными из schema.zmodel
 *
 * @example Конфигурация в schema.zmodel
 * ```zmodel
 * plugin formSchema {
 *   provider = '@lena/zenstack-form-plugin'
 *   output = './src/generated/form-schemas'
 * }
 * ```
 *
 * @example Enum с метками
 * ```zmodel
 * enum RecipeType {
 *   SWEET   // Сладкое
 *   SALTY   // Солёное
 * }
 * ```
 *
 * @example Модель с @form.* директивами
 * ```zmodel
 * model Product {
 *   name  String
 *         /// @form.title("Название")
 *         /// @form.placeholder("Введите название")
 *
 *   price Decimal
 *         /// @form.title("Цена")
 *         /// @form.fieldType("currency")
 *         /// @form.props({ currency: "RUB" })
 * }
 * ```
 */

import type { CliGeneratorContext, CliPlugin } from '@zenstackhq/sdk'
import { generate } from './generator.js'

/**
 * ZenStack CLI плагин для генерации form-схем
 */
const plugin: CliPlugin = {
  name: 'FormSchema',
  statusText: 'Generating Zod form schemas with UI metadata',

  async generate(context: CliGeneratorContext): Promise<void> {
    await generate(context)
  },
}

export default plugin

// Реэкспорт типов для удобства
export type { EnumInfo, EnumValueInfo, FormFieldMeta, ModelFieldInfo, ModelInfo } from './types.js'

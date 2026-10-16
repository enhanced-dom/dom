import path from 'path'
import { jestConfigFactory } from '@enhanced-dom/jest'

const baseConfig = jestConfigFactory({ ts: true, processorConfigPath: path.join(import.meta.dirname, 'tsconfig.json') })
export default {
  ...baseConfig,
  transformIgnorePatterns: ['node_modules/(?!@enhanced-dom/|lodash-es)'],
}

import nx from '@nx/eslint-plugin'
import baseConfig from '../../eslint.config.mjs'

export default [...baseConfig, ...nx.configs['flat/typescript'], { ignores: ['dist/**/*', '.next/**/*', '**/out-tsc'] }]

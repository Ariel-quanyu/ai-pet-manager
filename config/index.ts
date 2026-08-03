import { defineConfig } from '@tarojs/cli'
import path from 'node:path'
import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig<'webpack5'>(async (merge, { mode }) => {
  const base = {
    projectName: 'ai-pet-manager', date: '2026-08-03', designWidth: 750,
    deviceRatio: { 750: 1 }, sourceRoot: 'src', outputRoot: 'dist',
    alias: { '@': path.resolve(__dirname, '..', 'src') },
    framework: 'react', compiler: 'webpack5', cache: { enable: false },
    mini: { postcss: { pxtransform: { enable: true }, url: { enable: true, config: { limit: 1024 } }, cssModules: { enable: false } } }
  }
  return merge({}, base, mode === 'development' ? devConfig : prodConfig)
})

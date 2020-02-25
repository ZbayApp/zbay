import path from 'path'
import { exec, spawn } from 'child_process'
import fs from 'fs-extra'
import os from 'os'
import electronStore from '../../shared/electronStore'

import { credentials } from '../../renderer/zcash'
import config from '../config'

const ZCASH_RESOURCES = 'zcash'
const ZCASH_PARAMS = 'ZcashParams'

const isDev = process.env.NODE_ENV === 'development'

const FSP = fs.promises

const copyDir = async (src, dest) => {
  const entries = await FSP.readdir(src, { withFileTypes: true })
  await FSP.mkdir(dest)
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await FSP.copyFile(srcPath, destPath)
    }
  }
}
export const getResourcesPath = (...paths) => {
  if (isDev) {
    // Development mode resources are located in project root.
    return path.join.apply(null, [process.cwd(), ...paths])
  }
  // In builds the resources directory is located in 'Contents/Resources'
  return path.join.apply(null, [process.resourcesPath, ...paths])
}

export const getZcashResource = (name, platform) =>
  getResourcesPath(ZCASH_RESOURCES, platform, name)

export const ensureZcashParams = async (platform, callback) => {
  const binaryPath = getZcashResource('zcash-fetch-params', platform)
  if (process.platform === 'win32') {
    try {
      await copyDir(
        getResourcesPath(ZCASH_PARAMS),
        `${os.userInfo().homedir}\\AppData\\Roaming\\ZcashParams`
      )
    } catch (err) {
      console.log(err)
    }
    callback()
  } else {
    exec(binaryPath, callback)
  }
}
export const spawnZcashNode = (platform, isTestnet, torUrl = false) => {
  const isRescaned = electronStore.get('AppStatus.blockchain.isRescanned')
  const blockchainStatus = electronStore.get('AppStatus.blockchain.status')
  let zcashdPath = getZcashResource('zcashd', platform)
  const configName = isTestnet ? 'testnet.conf' : 'mainnet.conf'
  let options
  if (process.platform === 'win32') {
    options = [
      `-conf=${
        os.userInfo().homedir
      }\\AppData\\Local\\Programs\\zbay\\resources\\zcash\\mainnet.conf`,
      '-debug=1'
    ]
    zcashdPath = zcashdPath + '.exe'
  } else {
    options = [
      `-conf=${getResourcesPath(ZCASH_RESOURCES, configName)}`,
      '-debug=1',
      '-txexpirydelta=18000',
      '-checklevel=0',
      '-checkblocks=10',
      '-dbcache=500'
    ]
  }

  if (torUrl) {
    options.push(`-proxy=${torUrl}`)
  }
  if (!isRescaned && blockchainStatus === config.BLOCKCHAIN_STATUSES.SUCCESS) {
    options.push('-rescan')
  }
  const rpcCredentials = credentials()
  options.push(`-rpcuser=${rpcCredentials.username}`)
  options.push(`-rpcpassword=${rpcCredentials.password}`)
  return spawn(zcashdPath, options)
}
export default {
  spawnZcashNode,
  ensureZcashParams
}

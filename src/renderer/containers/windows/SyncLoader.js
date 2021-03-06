import React, { useEffect } from 'react'
import { Redirect } from 'react-router'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import BigNumber from 'bignumber.js'

import SyncLoaderComponent from '../../components/windows/SyncLoader'
import nodeSelectors from '../../store/selectors/node'
import identitySelectors from '../../store/selectors/identity'
import identityHandlers from '../../store/handlers/identity'
import logsHandlers from '../../store/handlers/logs'
import nodeHandlers from '../../store/handlers/node'
import vaultSelectors from '../../store/selectors/vault'
import { actionCreators } from '../../store/handlers/modals'
import vaultHandlers from '../../store/handlers/vault'
import electronStore from '../../../shared/electronStore'
import store from '../../../renderer/store'

import { useInterval } from '../hooks'
import config from '../../../main/config'

export const mapStateToProps = state => ({
  node: nodeSelectors.node(state),
  creating: vaultSelectors.creating(state),
  exists: vaultSelectors.exists(state),
  locked: vaultSelectors.locked(state),
  bootstrapping: nodeSelectors.bootstrapping(state),
  bootstrappingMessage: nodeSelectors.bootstrappingMessage(state),
  nodeConnected: nodeSelectors.isConnected(state),
  fetchingStatus: nodeSelectors.fetchingStatus(state),
  fetchingPart: nodeSelectors.fetchingPart(state),
  fetchingSizeLeft: nodeSelectors.fetchingSize(state),
  fetchingSpeed: nodeSelectors.fetchingSpeed(state),
  fetchingEndTime: nodeSelectors.fetchingEndTime(state),
  hasAddress: identitySelectors.address(state),
  isRescanningMonitorStarted: nodeSelectors.isRescanningMonitorStarted(state),
  rescanningProgress: nodeSelectors.rescanningProgress(state),
  isFetching: nodeSelectors.isFetching(state),
  isRescanningInitialized: nodeSelectors.isRescanningInitialized(state),
  loader: identitySelectors.loader(state),
  guideStatus: nodeSelectors.guideStatus(state)
})
export const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      getStatus: nodeHandlers.epics.getStatus,
      openModal: actionCreators.openModal('topUp'),
      resetNodeStatus: () => nodeHandlers.actions.setStatus({ 'status': 'down' }),
      startRescanningMonitor: nodeHandlers.epics.startRescanningMonitor,
      disablePowerSaveMode: nodeHandlers.epics.disablePowerSaveMode,
      setRescanningInitialized: nodeHandlers.epics.setRescanningInitialized,
      setVaultIdentity: vaultHandlers.epics.setVaultIdentity,
      loadIdentity: identityHandlers.epics.loadIdentity,
      createVault: vaultHandlers.epics.createVault
    },
    dispatch
  )

export const SyncLoader = ({ setVaultIdentity, createVault, loader, guideStatus, resetNodeStatus, setRescanningInitialized, loadIdentity, isRescanningInitialized, isFetching, disablePowerSaveMode, isRescanningMonitorStarted, rescanningProgress, startRescanningMonitor, hasAddress, node, getStatus, bootstrapping, bootstrappingMessage, nodeConnected, openModal, creating, locked, exists, fetchingPart, fetchingSizeLeft, fetchingStatus, fetchingEndTime, fetchingSpeed }) => {
  const isGuideCompleted = electronStore.get('storyStatus') || guideStatus
  const blockchainStatus = electronStore.get('AppStatus.blockchain.status')
  const blockchainConfiguration = electronStore.get('blockchainConfiguration')
  const isFetchedFromExternalSource = electronStore.get('isBlockchainFromExternalSource')
  const vaultStatus = electronStore.get('vaultStatus')
  const lastBlock = node.latestBlock.isEqualTo(0) ? 999999 : node.latestBlock
  const isSynced = (!node.latestBlock.isEqualTo(0) && node.latestBlock.minus(node.currentBlock).lt(10)) && new BigNumber(lastBlock).gt(790000)
  const fetching = ((((27952539059 - (fetchingSizeLeft)) * 100) / 27952539059)).toFixed()
  const syncProgress = parseFloat((node.currentBlock.div(lastBlock).times(100)).toString()).toFixed(2)
  const useCustomLocation = blockchainConfiguration === config.BLOCKCHAIN_STATUSES.TO_FETCH
  let ETA = null
  if (fetchingEndTime) {
    const { hours, minutes } = fetchingEndTime
    ETA = `${hours ? `${hours}h` : ''} ${minutes ? `${minutes}m left` : ''}`
  }
  const isFetchingComplete = ((fetchingPart === 'blockchain' && fetchingStatus === 'SUCCESS') || blockchainStatus === 'SUCCESS' || (isFetchedFromExternalSource && !useCustomLocation))
  let progressValue
  let message
  useInterval(() => {
    getStatus()
  }, 10000)
  useEffect(() => {
    if (!hasAddress && vaultStatus === 'CREATED') {
      loadIdentity()
    }
  }, [])
  useEffect(
    () => {
      if (!exists && !bootstrapping && nodeConnected) {
        createVault()
      }
    },
    [nodeConnected, bootstrapping, exists]
  )
  useEffect(
    () => {
      if ((!locked && nodeConnected && fetchingPart === 'blockchain' && fetchingStatus === 'SUCCESS') || blockchainStatus === 'SUCCESS' || (isFetchedFromExternalSource && !useCustomLocation)) {
        if (nodeConnected && isSynced && !isRescanningInitialized && hasAddress) {
          setVaultIdentity()
          resetNodeStatus()
          setRescanningInitialized()
          electronStore.set('isSynced', true)
          store.dispatch(logsHandlers.epics.saveLogs({ type: 'APPLICATION_LOGS', payload: `Blockchain synced` }))
        }
      }
    },
    [nodeConnected, fetchingStatus, fetchingPart, locked, isSynced, isRescanningInitialized, hasAddress]
  )
  if (!isFetchingComplete) {
    const fetchingProgress = new BigNumber(fetching).isEqualTo(100) ? 0 : new BigNumber(fetching).gt(90) ? 90 : fetching
    progressValue = fetchingProgress
  } else if (isRescanningInitialized) {
    progressValue = 99
    message = `Rescanning, ~25 minutes left`
  } else {
    progressValue = syncProgress === '0.00' ? 91 : syncProgress - 5
    message = `Final sync (${node.currentBlock}/${lastBlock}) ~40 minutes left`
  }
  return (isSynced && isRescanningInitialized && !loader.loading && node.status === 'healthy') ? (
    <Redirect to='/main/channel/general' />
  ) : (
    <SyncLoaderComponent
      isRescanningMonitorStarted={isRescanningMonitorStarted}
      rescanningProgress={rescanningProgress}
      fetchingEndTime={fetchingEndTime}
      fetchingSpeed={fetchingSpeed}
      hasAddress={hasAddress}
      node={node}
      blockchainStatus={blockchainStatus}
      bootstrapping={bootstrapping}
      bootstrappingMessage={bootstrappingMessage}
      openModal={openModal}
      nodeConnected={nodeConnected}
      fetchingPart={fetchingPart}
      fetchingSizeLeft={fetchingSizeLeft}
      fetchingStatus={fetchingStatus}
      ETA={ETA}
      isFetchedFromExternalSource={isFetchedFromExternalSource}
      progressValue={progressValue}
      isFetching={isFetching}
      isGuideCompleted={isGuideCompleted}
      useCustomLocation={useCustomLocation}
      message={message} />
  )
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SyncLoader)

import Immutable from 'immutable'
import { createAction, handleActions } from 'redux-actions'
import net from 'net'
import { remote } from 'electron'

import bootstrap from '../../../main/zcash/bootstrap'
import torSelectors from '../selectors/tor'
import { successNotification } from './utils'
import notificationsHandlers from './notifications'
import nodeHandlers from './node'

export const client = new net.Socket()

const isTestnet = parseInt(process.env.ZBAY_IS_TESTNET)
export var nodeProc = null

remote.process.on('exit', () => {
  if (nodeProc !== null) {
    nodeProc.kill()
  }
})

export const Tor = Immutable.Record(
  {
    url: '',
    enabled: false,
    error: null,
    status: ''
  },
  'Tor'
)
export const initialState = Tor()

const setEnabled = createAction('SET_TOR_ENABLED')
const setUrl = createAction('SET_TOR_URL')
const setError = createAction('SET_TOR_ERROR')
const setStatus = createAction('SET_TOR_STATUS')

export const actions = {
  setUrl,
  setEnabled,
  setError,
  setStatus
}

const checkTor = () => async (dispatch, getState) => {
  const tor = torSelectors.tor(getState())
  const url = tor.url.split(':')
  dispatch(setStatus({ status: 'loading' }))
  setTimeout(() => {
    if (torSelectors.tor(getState()).status === 'loading') {
      dispatch(setStatus({ status: 'down' }))
      dispatch(setError({ error: 'Timeout error' }))
    }
  }, 5000)
  try {
    client.connect(
      url[1],
      url[0],
      () => {
        const msg = Buffer.from('050100', 'hex')
        client.write(msg)
      }
    )
  } catch (err) {
    dispatch(setStatus({ status: 'down' }))
    dispatch(setError({ error: err.message }))
  }
  client.on('error', () => {
    dispatch(setStatus({ status: 'down' }))
    dispatch(setError({ error: 'Can not establish a connection' }))
  })
  client.on('data', data => {
    client.destroy() // kill client after server's response
    if (Buffer.from(data).toString('hex') === '0500') {
      dispatch(setStatus({ status: 'stable' }))
      dispatch(setError({ error: '' }))
    } else {
      dispatch(setStatus({ status: 'down' }))
      dispatch(setError({ error: 'Can not establish a connection' }))
    }
  })
}
export const createZcashNode = torUrl => async (dispatch, getState) => {
  dispatch(nodeHandlers.actions.setBootstrapping(true))
  dispatch(nodeHandlers.actions.setBootstrappingMessage('Ensuring zcash params are present'))
  if (torUrl) {
    dispatch(
      notificationsHandlers.actions.enqueueSnackbar(
        successNotification({ message: `You are using Tor proxy.` })
      )
    )
  }
  bootstrap.ensureZcashParams(process.platform, error => {
    if (error) {
      throw error
    }
    dispatch(nodeHandlers.actions.setBootstrapping(true))
    dispatch(nodeHandlers.actions.setBootstrappingMessage('Launching zcash node'))

    nodeProc = bootstrap.spawnZcashNode(process.platform, isTestnet, torUrl)
    dispatch(nodeHandlers.actions.setBootstrapping(false))
    dispatch(nodeHandlers.actions.setBootstrappingMessage(''))
    nodeProc.on('close', () => {
      nodeProc = null
    })
  })
}
export const epics = {
  checkTor,
  createZcashNode
}

export const reducer = handleActions(
  {
    [setEnabled]: (state, { payload: { enabled } }) =>
      state.set('enabled', enabled).set('status', 'down'),
    [setUrl]: (state, { payload: { url } }) => state.set('url', url).set('status', 'down'),
    [setError]: (state, { payload: { error } }) => state.set('error', error),
    [setStatus]: (state, { payload: { status } }) => state.set('status', status)
  },
  initialState
)
export default {
  actions,
  epics,
  reducer
}
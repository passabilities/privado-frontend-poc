import Axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import { QRCode } from 'react-qr-svg'
import Modal from 'react-modal'
import './App.css'

const axios = Axios.create({
  baseURL: 'https://privado-backend-poc.fly.dev/',
})

const useCreateSession = ({ reason }: { reason?: string }) => {
  const [ sessionId, setSessionId ] = React.useState<string>()
  const [ scope, setScope ] = useState<any[]>()
  const [ sessionResponse, setSessionResponse ] = useState<{
    body: {
      scope: {
        id: number;
        vp?: { verifiableCredential: { credentialSubject: { '@type': string; [key: string]: any } } }
      }[]
    }
  }>()

  const [ prevCancelToken, setPrevCancelToken ] = useState<any>()

  const reset = () => {
    setSessionId(undefined)
    setScope(undefined)
    setSessionResponse(undefined)
  }

  const create = useCallback(async (scope: any[]) => {
    reset()

    if (prevCancelToken) {
      prevCancelToken.cancel()
    }
    const newCancelToken = Axios.CancelToken.source()
    setPrevCancelToken(newCancelToken)

    setScope(scope)

    try {
      const { data: { id: sessionId } } = await axios.post<{ id: string }>('/auth-request', {
        reason,
        scope: scope.map(({ key, value = {} }, index) => ({
          id: index,
          circuitId: 'credentialAtomicQuerySigV2',
          query: {
            allowedIssuers: [ '*' ],
            type: 'IndividualKYC',
            context: 'ipfs://Qmdhuf9fhqzweDa1TgoajDEj7Te7p28eeeZVfiioAjUC15',
            credentialSubject: {
              [key]: value,
            },
          },
        })),
      }, {
        cancelToken: newCancelToken?.token,
      })
      setSessionId(sessionId)

      const { data: sessionResponse } = await axios.get<{
        body: {
          scope: {
            id: number;
            vp?: { verifiableCredential: { credentialSubject: { '@type': string; [key: string]: any } } }
          }[]
        }
      }>('/auth-response', { params: { sessionId }, cancelToken: newCancelToken?.token })
      setSessionResponse(sessionResponse)
    } catch (err) {
      console.error(err)
      reset()
    }
  }, [ prevCancelToken, reason ])

  return {
    create,
    sessionId,
    scope,
    response: sessionResponse,
  }
}

type Query = { label: string; key: string; type: 'disclose' | 'verify'; value?: any }
const USA_QUERY: Query = {
  label: 'Lives in USA',
  key: 'country',
  type: 'verify',
  value: { $eq: 'United States of America' },
}
const NON_USA_QUERY: Query = {
  label: 'Lives outside USA',
  key: 'country',
  type: 'verify',
  value: { $ne: 'United States of America' },
}
const SCOPE_QUERIES: Query[] = [
  { label: 'Full Name', key: 'full-name', type: 'disclose' },
  { label: 'Email', key: 'email', type: 'disclose' },
  { label: 'Email Verified', key: 'email-verified', type: 'verify', value: { $eq: true } },
]

function App() {
  const [ modelOpen, setModelOpen ] = useState(false)

  const session = useCreateSession({})

  useEffect(() => {
    if (modelOpen && session.response) setModelOpen(false)
  }, [ modelOpen, session.response ])

  return (
    <div className="App">
      <div className="wrapper">
        <button
          className="button"
          onClick={() => {
            const queries = [ ...SCOPE_QUERIES ]
            queries.splice(1, 0, USA_QUERY)
            void session.create(queries)

            setModelOpen(true)
          }}
        >
          Verify USA Credential
        </button>
        <button
          className="button"
          onClick={() => {
            const queries = [ ...SCOPE_QUERIES ]
            queries.splice(1, 0, NON_USA_QUERY)
            void session.create(queries)

            setModelOpen(true)
          }}
        >
          Verify non USA Credential
        </button>
        <Modal
          style={{
            content: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            },
          }}
          isOpen={modelOpen}
          onRequestClose={() => setModelOpen(false)}
        >
          <h1>Scan to Verify Credential</h1>
          {session.sessionId && (
            <QRCode
              className="qrcode"
              level="Q"
              value={`iden3comm://?request_uri=${axios.defaults.baseURL}/auth-request?sessionId=${session.sessionId}`}
            />
          )}
        </Modal>

        {session.response && session.scope && (
          <table>
            {session.scope.map(({ label, key, type, value }, index) => (
              <tr key={index}>
                <td
                  style={{ display: 'flex', justifyContent: 'right', marginRight: 10, fontWeight: 'bold' }}>{label}</td>
                <td style={{ fontSize: 'calc(10px + 1vmin)' }}>
                  {type === 'verify' && (
                    <input className="disabled" type="checkbox" checked/>
                  )}
                  {type === 'disclose' && (
                    session.response?.body.scope[index].vp?.verifiableCredential.credentialSubject[key]
                  )}
                </td>
              </tr>
            ))}
          </table>
        )}
      </div>
    </div>
  )
}

export default App

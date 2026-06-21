import nock from 'nock'
import { Probot, ProbotOctokit } from 'probot'
import { beforeEach, test, expect, afterEach } from '@jest/globals'

let probot: Probot | undefined

const myProbotApp = await import('../src/index.ts')
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAu5amcvGOpDUVJmkyX4UtcOQPydBlSl8a/SV4QpUq+8CY7xaf
IzJ0b+1PfT4WgvQo8ouFE1OCIVK7v2DuB6FRkZRJ3U8m/LX8GgMp0c2VmeFdaguv
sPQe8ra+fcpZETNkZKnt1YgmX3NsvqjYtDAgKt8Bd6q9yRuGRpYLrMrkPd6zv7UK
eiDiBQBHZxtJaMDWP/pRAsN5PHBzJ+YdfwOWTtWH7Zks98Tiq3oQHVriGPPH9Vlk
s9S2RPgWdpYvHnsIdzTZXL2/MDWFukUVBWfT1Rk8RIx33C3ov63qwSs0LIFzoEcf
+P7/79j/c9+tqywBZNCiFHjJZ9oP0EBoZ7sLFQIDAQABAoIBABBS6MMh4B7L+74u
81I6nZywS+ts9hOFuSyEQTXSEz57IRPVLR37+wPua7djWsQkiReqKndnEfDiaTIb
Njt1v0pi1BatF6BwGbMNyWrXcAhHA0ECKVTFuZe3bVY28I89oKPd4bNuOKCfw7vH
p6vucC4q387RDdjdS08DKZrswPXdMBLZIACr9I63xTxEoukBL7qsvKOokx96A7cH
Aan/56p11MpD7S4GjdkYFwN2mtkAoucApjtg5HV+woKsLqakDliCXOzCxVTzHwqt
42+nVEjWCI+QfkiJyNQYtSxyTFtyDnwiQ4WaEcC0giWtRyIpHcwDVwy7WGxnCkys
lAWScpUCgYEA7l3XG8mYhZDomiVUGUmp2SlLd+N3QnBxks8DK5KxYoA1AUDnXdmT
s+B0tWIPzyAvvnsj40y/o6Qz4Ah3HDyJRiKNJ+GBPewLmjR/npyoPJywkFadiMbs
ai/eq7xZyAjIDE/MYecumbJMWVDyfUJ90OA+Ir0SZbal6O8SWlQORXcCgYEAyXcu
HDc+0r/wiTWp9Rvl+28XvSONcnOaiqcj0q4rbv+2gqFZt7Aulb0QNm/Ow3JY79y2
/6xXBYDLwO/ohP9cDljAxD1CPxzpJWSaDM6Fge+KUf2Y2CS9R+SJBzcd92VJuUXD
Kc7yxKbBtsgkgByJvelL1wF3IDxh86EsllohBtMCgYEAoYG5v10v18ggolkKi3vK
9pYxSVE5PC4d9gAHwN1LDVebEndcjM1gc69wxHlmBsxjLSgYX+lfq8wVTgXOVrZ5
uKiuhcgYntEx51EM63Zv02nDhHj7knJeO3Cl6izblFrG2Pi0nd1bSM5zRs0/EDoe
L4nQ8A61yW8hKRvbjpKHfO8CgYBqBliz7LcZPn4eF6ncHtSH4E1D8sPr6b75HUET
DSo6fkTUtol6zDOYBinUHD9aSIFZqnR8VXxunvucDCX4aFNQEZFRNVP51wMz9J/G
AaHtYd0PjUC075DVlwYuT+lrW1jTMk2lYQ4ORBxKT0Y2Tc6HrZGGE3VX968tAjNu
5PvglQKBgQDtR4eIdMJ60FfQoX/9MrxEV7Fkru3DBfr48ZC5HKksj7MytOD23ouc
cDIUGO9eluOat3V1vIlRyZ4BJsL/YbrVh8HfZ4+XD5vn37krunyR8HfY0GeWpFTH
/ku7U7Z+BSQ9+D3Ifvt7jimPoGTWP7aoNRfFwwAg8muCZSEuTdMdVA==
-----END RSA PRIVATE KEY-----`

beforeEach(async () => {
  nock.disableNetConnect()
  probot = new Probot({
    appId: 123,
    privateKey,
    // disable request throttling and retries for testing
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  })
  // @ts-ignore
  await probot.load(myProbotApp.default || myProbotApp)
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  probot = undefined
})

test('creates a pull request to update versions when a release is created', async () => {
  const workflowDispatchBodies: any[] = []
  const mock = nock('https://api.github.com')
    .get('/repos/lvce-editor/helper-bot/installation')
    .reply(200, {
      id: 44,
    })
    .post('/app/installations/44/access_tokens')
    .reply(200, {
      expires_at: '2026-05-20T00:00:00Z',
      permissions: {},
      repository_selection: 'selected',
      token: 'installation-token',
    })
    .post('/repos/lvce-editor/helper-bot/actions/workflows/run-migration-on-demand.yml/dispatches', (body) => {
      workflowDispatchBodies.push(body)
      return true
    })
    .reply(204)

  // Receive a webhook event
  await probot.receive({
    name: 'release',
    payload: {
      action: 'released',
      release: {
        tag_name: 'v2.4.0',
      },
      repository: {
        name: 'renderer-process',
        // @ts-ignore
        owner: {
          login: 'lvce-editor',
        },
      },
    },
  })
  expect(workflowDispatchBodies).toEqual([
    {
      inputs: {
        baseBranch: 'main',
        migrationId: '/migrations2/update-specific-dependency',
        migrationOptionsJson: '{"fromRepo":"renderer-process","tagName":"v2.4.0","toFolder":"packages/renderer-worker","toRepo":"lvce-editor"}',
        requestId: expect.any(String),
        runName: 'migration-on-demand/lvce-editor/update-specific-dependency',
        targetRepository: 'lvce-editor/lvce-editor',
      },
      ref: 'main',
    },
  ])
  expect(mock.pendingMocks()).toEqual([])
})

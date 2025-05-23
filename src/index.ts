import { Context, Probot } from 'probot'
import { handleDependencies } from './dependencies.js'
import { updateBuiltinExtensions } from './updateBuiltinExtensions.js'
import { updateDependencies } from './updateDependencies.js'

const dependencies = [
  {
    fromRepo: 'eslint-config',
    toRepo: 'text-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'test-worker',
    toRepo: 'test-with-playwright',
    toFolder: 'packages/build',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'file-watcher-process',
    toFolder: '',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'renderer-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'embeds-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'color-picker-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'embeds-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'main-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/main-process',
  },
  {
    fromRepo: 'iframe-inspector',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'markdown-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'rename-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'terminal-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'test-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-host-sub-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'title-bar-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'explorer-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'editor-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'error-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'diff-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'keybindings-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-search-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-detail-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'iframe-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'extension-host-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'syntax-highlighting-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'about-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'source-control-view',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
    asName: 'source-control-worker',
  },
  {
    fromRepo: 'file-search-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'text-search-worker',
    toRepo: 'lvce-editor',
    toFolder: 'packages/renderer-worker',
  },
  {
    fromRepo: 'virtual-dom',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'preview-injected-code',
    toRepo: 'preview-process',
    toFolder: 'packages/preview-process',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'rpc',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'rpc',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'typescript-compile-process',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'extension-host-worker',
    toFolder: 'packages/extension-host-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'pty-host',
    toFolder: 'packages/pty-host',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'extension-host-worker',
    toFolder: 'packages/extension-host-sub-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'iframe-worker',
    toFolder: 'packages/iframe-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'about-view',
    toFolder: 'packages/about-view',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'about-view',
    toFolder: 'packages/about-view',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'file-system-worker',
    toFolder: 'packages/file-system-worker',
  },
  {
    fromRepo: 'eslint-config',
    toRepo: 'file-system-worker',
    toFolder: 'packages/file-system-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'file-system-worker',
    toFolder: 'packages/file-system-worker',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'embeds-worker',
    toFolder: 'packages/embeds-worker',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'keybindings-view',
    toFolder: 'packages/keybindings-view',
  },
  {
    fromRepo: 'rpc-registry',
    toRepo: 'explorer-view',
    toFolder: 'packages/explorer-view',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'file-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'text-search-worker',
    toFolder: 'packages/text-search-worker',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'explorer-view',
    toFolder: 'packages/explorer-view',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'editor-worker',
    toFolder: '',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'syntax-highlighting-worker',
    toFolder: '',
  },
  {
    fromRepo: 'ripgrep',
    toRepo: 'search-process',
    toFolder: '',
  },
  {
    fromRepo: 'rpc',
    toRepo: 'search-process',
    toFolder: '',
  },
  {
    fromRepo: 'ipc',
    toRepo: 'lvce-editor',
    toFolder: 'packages/main-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'editor-worker',
    toFolder: '',
  },
  {
    fromRepo: 'command',
    toRepo: 'file-search-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'renderer-process',
    toFolder: 'packages/renderer-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'preview-process',
    toFolder: 'packages/preview-process',
  },
  {
    fromRepo: 'preview-injected-code',
    toRepo: 'preview-process',
    toFolder: '/packages/preview-process',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'test-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'syntax-highlighting-worker',
    toFolder: '',
  },
  {
    fromRepo: 'json-rpc',
    toRepo: 'iframe-worker',
    toFolder: '',
  },
  {
    fromRepo: 'network-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'file-system-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'file-watcher-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'preview-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'search-process',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'pty-host',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
  {
    fromRepo: 'preload',
    toRepo: 'lvce-editor',
    toFolder: 'packages/shared-process',
  },
]

const updateRepositoryDependencies = async (context: Context<'release'>) => {
  for (const dependency of dependencies) {
    try {
      await updateDependencies(context, dependency)
    } catch (error) {
      console.error(error)
    }
  }
}

const handleReleaseReleased = async (context: Context<'release'>) => {
  await Promise.all([
    updateBuiltinExtensions(context),
    updateRepositoryDependencies(context),
  ])
}

const handleHelloWorld = (req: any, res: any) => {
  res.send('Hello World')
}

const enableCustomRoutes = async (app: Probot, getRouter: any) => {
  if (!getRouter || typeof getRouter !== 'function') {
    return
  }
  const router = getRouter('/my-app')

  router.get('/hello-world', handleHelloWorld)

  const installationIdString = process.env.INSTALLATION_ID
  if (!installationIdString) {
    throw new Error('installation id not found')
  }
  const installationId = parseInt(installationIdString)

  router.post(
    '/update-dependencies',
    handleDependencies({
      app,
      installationId,
      secret: process.env.DEPENDENCIES_SECRET,
    }),
  )
}

export default (app: Probot, { getRouter }: any) => {
  enableCustomRoutes(app, getRouter)
  app.on('release.released', handleReleaseReleased)
}

export interface UpdatePackageJsonDependenciesOptions {
  latestRpcRegistryVersion: string
  latestRpcVersion: string
  packageJson: any
}

export const updatePackageJsonDependencies = (options: Readonly<UpdatePackageJsonDependenciesOptions>): boolean => {
  const { latestRpcRegistryVersion, latestRpcVersion, packageJson } = options
  let updated = false

  // Update @lvce-editor/rpc to latest version
  if (packageJson.dependencies && packageJson.dependencies['@lvce-editor/rpc']) {
    packageJson.dependencies['@lvce-editor/rpc'] = `^${latestRpcVersion}`
    updated = true
  }
  if (packageJson.devDependencies && packageJson.devDependencies['@lvce-editor/rpc']) {
    packageJson.devDependencies['@lvce-editor/rpc'] = `^${latestRpcVersion}`
    updated = true
  }

  // Update @lvce-editor/rpc-registry to latest version
  if (packageJson.dependencies && packageJson.dependencies['@lvce-editor/rpc-registry']) {
    packageJson.dependencies['@lvce-editor/rpc-registry'] = `^${latestRpcRegistryVersion}`
    updated = true
  }
  if (packageJson.devDependencies && packageJson.devDependencies['@lvce-editor/rpc-registry']) {
    packageJson.devDependencies['@lvce-editor/rpc-registry'] = `^${latestRpcRegistryVersion}`
    updated = true
  }

  return updated
}

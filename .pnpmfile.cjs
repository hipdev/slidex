// Auth v2's Next.js adapter is unused by Rebask and the backend.
// pnpm 11 can retain this optional peer after removing the application's Next
// dependency. Omit only that peer; keep every runtime/auth dependency unchanged.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@convex-dev/auth" && pkg.version === "2.0.0") {
        delete pkg.peerDependencies?.next
        delete pkg.peerDependenciesMeta?.next
      }
      return pkg
    },
  },
}

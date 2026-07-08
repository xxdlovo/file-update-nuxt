export default defineEventHandler(async (event) => {
  return buildElectronUpdaterMetadata(event)
})

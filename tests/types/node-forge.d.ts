declare module "node-forge" {
  const forge: {
    pki: {
      rsa: {
        generateKeyPair(bits: number): { publicKey: unknown; privateKey: unknown }
      }
      createCertificate(): {
        publicKey: unknown
        serialNumber: string
        validity: { notBefore: Date; notAfter: Date }
        setSubject(attrs: Array<{ name: string; value: string }>): void
        setIssuer(attrs: Array<{ name: string; value: string }>): void
        sign(privateKey: unknown): void
      }
      privateKeyToPem(key: unknown): string
      certificateToPem(cert: unknown): string
    }
  }
  export default forge
}

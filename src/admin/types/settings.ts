export type PaymentMethodSetting = { code: string; displayName: string; active: boolean; sortOrder: number; requiresProof: boolean }
export type VerificationSettings = { paperAddition: boolean; faultyPaper: boolean; closing: boolean }
export type AdminSettings = {
  printPrice: number; businessName: string; currency: string
  paymentMethods: PaymentMethodSetting[]; verification: VerificationSettings
}

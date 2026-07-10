export type Household = {
  id: string
  name: string
  joinCode: string
  isDemo: boolean
  createdAt: string
}

export type SessionPayload = {
  hid: string
  sid: string
  iat: number
}

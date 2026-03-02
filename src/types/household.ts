export type Household = {
  id: string
  name: string
  joinCode: string
  isDemo: boolean
  createdAt: string
}

export type DeviceSession = {
  id: string
  householdId: string
  deviceName: string
  lastSeenAt: string
  createdAt: string
  isRevoked: boolean
}

export type SessionPayload = {
  hid: string
  sid: string
  iat: number
}

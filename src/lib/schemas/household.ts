import { z } from 'zod'

export const HouseholdCreateSchema = z.string().min(1).max(50)

export const JoinCodeSchema = z.string().regex(/^[A-Z]+-\d{4}$/)

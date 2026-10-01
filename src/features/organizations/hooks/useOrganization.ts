import { useCallback } from 'react'
import { useResource } from '../../../components/forms/useResource'
import { loadOrganizations } from '../services/organizations'
export function useOrganization(userId: string, selectedId?: string) { return useResource(useCallback(() => loadOrganizations(userId, selectedId), [userId, selectedId])) }

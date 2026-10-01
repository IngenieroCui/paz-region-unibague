import { useCallback } from 'react'
import { useResource } from '../../../components/forms/useResource'
import { loadStudent } from '../services/students'
export function useStudent(userId: string) { return useResource(useCallback(() => loadStudent(userId), [userId])) }

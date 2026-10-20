import { useCallback } from 'react'
import { useResource } from '../../../components/forms/useResource'
import { loadStudent } from '../services/students'
import type { StudentSection } from '../services/students'
export function useStudent(userId: string, section: StudentSection) { return useResource(useCallback(() => loadStudent(userId, section), [userId, section])) }

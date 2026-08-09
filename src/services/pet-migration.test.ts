import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { NeuterStatus, PetDraft } from '@/domain/pet'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260809000000_add_pet_profile_fields.sql'), 'utf8')

describe('pet profile migration', () => {
  it('matches the optional domain fields without rebuilding pets', () => {
    const weight: PetDraft['weight'] = '4.5'
    const statuses: NeuterStatus[] = ['yes', 'no', 'unknown']
    expect(weight).toBe('4.5')
    expect(statuses).toEqual(['yes', 'no', 'unknown'])
    expect(sql).toMatch(/add column if not exists weight numeric\(6,2\)/i)
    expect(sql).toMatch(/add column if not exists coat text/i)
    expect(sql).toContain("neuter in ('yes','no','unknown')")
    expect(sql).not.toMatch(/drop table|create table/i)
  })

  it('keeps RLS enabled with owner-only policies and authenticated grants', () => {
    expect(sql).toMatch(/alter table public\.pets enable row level security/i)
    expect(sql).toMatch(/for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\)/i)
    expect(sql).toMatch(/for insert to authenticated with check \(\(select auth\.uid\(\)\) = user_id\)/i)
    expect(sql).toMatch(/for update to authenticated[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/i)
    expect(sql).toMatch(/grant select, insert, update on public\.pets to authenticated/i)
  })
})

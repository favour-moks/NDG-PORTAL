'use client'

import { useState, useTransition } from 'react'
import { createReferenceRow, setReferenceRowActive, type ReferenceTable } from '@/lib/actions/reference'

function useReferenceForm(table: ReferenceTable) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function create(values: Record<string, unknown>, onSuccess: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await createReferenceRow(table, values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSuccess()
    })
  }

  function toggle(id: string, active: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await setReferenceRowActive(table, id, active)
      if (!result.ok) setError(result.error)
    })
  }

  return { error, isPending, create, toggle }
}

function ActiveCell({ active, onToggle, isPending }: { active: boolean; onToggle: () => void; isPending: boolean }) {
  return (
    <td>
      {active ? 'Active' : 'Inactive'}{' '}
      <button type="button" onClick={onToggle} disabled={isPending}>
        {active ? 'Deactivate' : 'Reactivate'}
      </button>
    </td>
  )
}

type Category = {
  id: string
  name: string
  group_key: string
  is_state_scoped: boolean
  requires_sport: boolean
  requires_committee: boolean
  sort_order: number
  active: boolean
}

export function CategoriesTab({ categories }: { categories: Category[] }) {
  const { error, isPending, create, toggle } = useReferenceForm('categories')
  const [name, setName] = useState('')
  const [groupKey, setGroupKey] = useState<'participants' | 'personnel'>('participants')
  const [isStateScoped, setIsStateScoped] = useState(false)
  const [requiresSport, setRequiresSport] = useState(false)
  const [requiresCommittee, setRequiresCommittee] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    create(
      {
        name: name.trim(),
        group_key: groupKey,
        is_state_scoped: isStateScoped,
        requires_sport: requiresSport,
        requires_committee: requiresCommittee,
        sort_order: categories.length,
      },
      () => {
        setName('')
        setIsStateScoped(false)
        setRequiresSport(false)
        setRequiresCommittee(false)
      }
    )
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label htmlFor="category-name">Name</label>
        <br />
        <input id="category-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <br />
        <label htmlFor="category-group">Group</label>
        <br />
        <select
          id="category-group"
          value={groupKey}
          onChange={(event) => setGroupKey(event.target.value as 'participants' | 'personnel')}
        >
          <option value="participants">Participants</option>
          <option value="personnel">Personnel</option>
        </select>
        <br />
        <label>
          <input
            type="checkbox"
            checked={isStateScoped}
            onChange={(event) => setIsStateScoped(event.target.checked)}
          />
          State-scoped
        </label>
        <label>
          <input
            type="checkbox"
            checked={requiresSport}
            onChange={(event) => setRequiresSport(event.target.checked)}
          />
          Requires sport
        </label>
        <label>
          <input
            type="checkbox"
            checked={requiresCommittee}
            onChange={(event) => setRequiresCommittee(event.target.checked)}
          />
          Requires committee
        </label>
        <br />
        <button type="submit" disabled={isPending}>
          Add category
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Group</th>
            <th scope="col">State-scoped</th>
            <th scope="col">Requires sport</th>
            <th scope="col">Requires committee</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td>{category.name}</td>
              <td>{category.group_key}</td>
              <td>{category.is_state_scoped ? 'Yes' : 'No'}</td>
              <td>{category.requires_sport ? 'Yes' : 'No'}</td>
              <td>{category.requires_committee ? 'Yes' : 'No'}</td>
              <ActiveCell
                active={category.active}
                onToggle={() => toggle(category.id, !category.active)}
                isPending={isPending}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type Committee = { id: string; name: string; edition_id: string | null; active: boolean }

export function CommitteesTab({ committees, editionId }: { committees: Committee[]; editionId: string | null }) {
  const { error, isPending, create, toggle } = useReferenceForm('committees')
  const [name, setName] = useState('')
  const [scopeToEdition, setScopeToEdition] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    create({ name: name.trim(), edition_id: scopeToEdition ? editionId : null }, () => {
      setName('')
      setScopeToEdition(false)
    })
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label htmlFor="committee-name">Name</label>
        <br />
        <input id="committee-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <br />
        <label>
          <input
            type="checkbox"
            checked={scopeToEdition}
            onChange={(event) => setScopeToEdition(event.target.checked)}
            disabled={!editionId}
          />
          Only for the current edition (leave unchecked to apply to every edition)
        </label>
        <br />
        <button type="submit" disabled={isPending}>
          Add committee
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Scope</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {committees.map((committee) => (
            <tr key={committee.id}>
              <td>{committee.name}</td>
              <td>{committee.edition_id ? 'This edition only' : 'All editions'}</td>
              <ActiveCell
                active={committee.active}
                onToggle={() => toggle(committee.id, !committee.active)}
                isPending={isPending}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type NamedActiveRow = { id: string; name: string; active: boolean }

export function SportsTab({ sports }: { sports: NamedActiveRow[] }) {
  const { error, isPending, create, toggle } = useReferenceForm('sports')
  const [name, setName] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    create({ name: name.trim() }, () => setName(''))
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label htmlFor="sport-name">Name</label>
        <br />
        <input id="sport-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit" disabled={isPending}>
          Add sport
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sports.map((sport) => (
            <tr key={sport.id}>
              <td>{sport.name}</td>
              <ActiveCell active={sport.active} onToggle={() => toggle(sport.id, !sport.active)} isPending={isPending} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type State = { id: string; name: string; code: string; active: boolean }

export function StatesTab({ states }: { states: State[] }) {
  const { error, isPending, create, toggle } = useReferenceForm('states')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !code.trim()) return
    create({ name: name.trim(), code: code.trim().toUpperCase() }, () => {
      setName('')
      setCode('')
    })
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label htmlFor="state-name">Name</label>
        <br />
        <input id="state-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <br />
        <label htmlFor="state-code">Code</label>
        <br />
        <input id="state-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={5} required />
        <br />
        <button type="submit" disabled={isPending}>
          Add state
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Code</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {states.map((state) => (
            <tr key={state.id}>
              <td>{state.name}</td>
              <td>{state.code}</td>
              <ActiveCell active={state.active} onToggle={() => toggle(state.id, !state.active)} isPending={isPending} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

type Bank = { id: string; name: string; active: boolean }

export function BanksTab({ banks }: { banks: Bank[] }) {
  const { error, isPending, create, toggle } = useReferenceForm('banks')
  const [id, setId] = useState('')
  const [name, setName] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!id.trim() || !name.trim()) return
    create({ id: id.trim(), name: name.trim() }, () => {
      setId('')
      setName('')
    })
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label htmlFor="bank-id">Institution code (CBN/NIP)</label>
        <br />
        <input id="bank-id" value={id} onChange={(event) => setId(event.target.value)} required />
        <br />
        <label htmlFor="bank-name">Name</label>
        <br />
        <input id="bank-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <br />
        <button type="submit" disabled={isPending}>
          Add bank
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Code</th>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {banks.map((bank) => (
            <tr key={bank.id}>
              <td>{bank.id}</td>
              <td>{bank.name}</td>
              <ActiveCell active={bank.active} onToggle={() => toggle(bank.id, !bank.active)} isPending={isPending} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

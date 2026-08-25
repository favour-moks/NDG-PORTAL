'use client'

import { useState, useTransition } from 'react'
import { deactivateUser, inviteUser, reactivateUser } from '@/lib/actions/users'

type Role = 'admin' | 'editor' | 'viewer'
type Option = { id: string; name: string }
type UserRow = {
  id: string
  fullName: string
  role: Role
  active: boolean
  stateNames: string[]
  // Pre-formatted server-side (page.tsx), not here — see the comment
  // there on why this avoids a hydration mismatch.
  lastSignInDisplay: string
}

export function UsersAdmin({
  users,
  states,
  isAdmin,
}: {
  users: UserRow[]
  states: Option[]
  isAdmin: boolean
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [stateIds, setStateIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleState(stateId: string, checked: boolean) {
    setStateIds((prev) => (checked ? [...prev, stateId] : prev.filter((id) => id !== stateId)))
  }

  function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await inviteUser({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        stateIds: role === 'viewer' ? stateIds : undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessage(`Invite sent to ${email.trim()}.`)
      setEmail('')
      setFullName('')
      setRole('viewer')
      setStateIds([])
    })
  }

  function handleDeactivate(userId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deactivateUser(userId)
      if (!result.ok) setError(result.error)
    })
  }

  function handleReactivate(userId: string) {
    setError(null)
    startTransition(async () => {
      const result = await reactivateUser(userId)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div>
      <form onSubmit={handleInvite}>
        <h2>Invite a user</h2>
        <label htmlFor="invite-email">Email</label>
        <br />
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <br />
        <label htmlFor="invite-name">Full name</label>
        <br />
        <input
          id="invite-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <br />
        <label htmlFor="invite-role">Role</label>
        <br />
        <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <br />
        {role === 'viewer' ? (
          <fieldset>
            <legend>Assigned states</legend>
            {states.map((state) => (
              <label key={state.id}>
                <input
                  type="checkbox"
                  checked={stateIds.includes(state.id)}
                  onChange={(event) => toggleState(state.id, event.target.checked)}
                />
                {state.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        <button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">States</th>
            <th scope="col">Last sign-in</th>
            <th scope="col">Status</th>
            {isAdmin ? <th scope="col">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.fullName}</td>
              <td>{user.role}</td>
              <td>{user.stateNames.length > 0 ? user.stateNames.join(', ') : '—'}</td>
              <td>{user.lastSignInDisplay}</td>
              <td>{user.active ? 'Active' : 'Deactivated'}</td>
              {isAdmin ? (
                <td>
                  {user.active ? (
                    <button type="button" onClick={() => handleDeactivate(user.id)} disabled={isPending}>
                      Deactivate
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleReactivate(user.id)} disabled={isPending}>
                      Reactivate
                    </button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route } from 'react-router-dom'
import WorkspaceSidebar, { sidebarSections } from './WorkspaceSidebar.jsx'
import { WorkspaceNavProvider } from './workspace-nav.jsx'
import { makeAuth, makeConfig, renderShell } from '../test/renderShell.jsx'

const sidebar = (
  <WorkspaceNavProvider>
    <WorkspaceSidebar />
  </WorkspaceNavProvider>
)

const form = { id: 'incident-form', name: 'Incident Form', icon: 'clipboard', isForm: true }
const envModules = [
  {
    id: 'climate',
    name: 'Climate',
    icon: 'cloud',
    solutions: [{ id: 'air', name: 'Air Quality', icon: 'activity' }],
  },
  {
    id: 'protected',
    name: 'Protected Areas',
    icon: 'mountain',
    groups: [
      {
        name: 'Monitoring',
        icon: 'shield',
        solutions: [{ id: 'incidents', name: 'Incident Monitoring', icon: 'activity', form }],
      },
    ],
    solutions: [{ id: 'incidents', name: 'Incident Monitoring', form }, form],
  },
]

describe('sidebarSections', () => {
  it('heads each module with its name, and lists flat solutions without forms', () => {
    const sections = sidebarSections([
      { id: 'a', name: 'A', solutions: [{ id: 'x' }, { id: 'f', isForm: true }] },
      { id: 'b', name: 'B', solutions: [] },
    ])
    expect(sections.map((s) => s.title)).toEqual(['A', 'B'])
    expect(sections[0].groups[0].solutions.map((s) => s.id)).toEqual(['x'])
  })

  it('makes groups the headings of a sole grouped module, and of an untitled module', () => {
    const grouped = { id: 'm', name: 'Mining', groups: [{ name: 'Sites', solutions: [] }, { name: 'Impact', solutions: [] }] }
    const [sole] = sidebarSections([grouped])
    expect(sole).toMatchObject({ title: null, groupsAreHeadings: true })
    const untitled = { ...grouped, untitled: true }
    const other = { id: 'o', name: 'Other', solutions: [] }
    const sections = sidebarSections([untitled, other])
    expect(sections.map((s) => [s.title, s.groupsAreHeadings])).toEqual([
      [null, true],
      ['Other', false],
    ])
  })

  it('drops a module heading that only repeats the portal name, but keeps group names', () => {
    const [flat] = sidebarSections([{ id: 'p', name: 'Population Mapping', solutions: [] }], 'Population Mapping')
    expect(flat.title).toBeNull()
    const [grouped] = sidebarSections([{ id: 'w', name: 'Water', groups: [{ name: 'Water Mapping', solutions: [] }, { name: 'Quality', solutions: [] }] }], 'Water Mapping')
    expect(grouped.groups.map((g) => g.name)).toEqual(['Water Mapping', 'Quality'])
  })

  it('keeps a titled module heading with its groups as sub-labels when there are several modules', () => {
    const sections = sidebarSections(envModules)
    expect(sections.map((s) => s.title)).toEqual(['Climate', 'Protected Areas'])
    expect(sections[1]).toMatchObject({ groupsAreHeadings: false })
    expect(sections[1].groups[0].name).toBe('Monitoring')
  })
})

describe('WorkspaceSidebar', () => {
  it('renders module headings, links and marks the open app active', () => {
    renderShell(sidebar, { path: '/module/roads/app/traffic' })
    expect(screen.getByText('Roads')).toBeInTheDocument()
    const active = screen.getByRole('link', { name: 'Traffic' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active).toHaveClass('is-active')
    expect(screen.getByRole('link', { name: 'Road Network' })).not.toHaveAttribute('aria-current')
  })

  it('labels every module region with its name, even when groups head it', () => {
    const modules = [{ id: 'c', name: 'Conservation', untitled: true, groups: [{ name: 'Parks', solutions: [{ id: 'p', name: 'Park Map' }] }], solutions: [] }, ...envModules]
    renderShell(sidebar, { config: makeConfig({ modules }) })
    const region = screen.getByRole('region', { name: 'Conservation' })
    expect(region).not.toHaveTextContent('Conservation')
    expect(region.querySelector('.workspace-menu-parent')).toHaveTextContent('Parks')
  })

  it('nests a dashboard form under its dashboard and shows group labels', () => {
    renderShell(sidebar, { path: '/module/protected/app/incident-form', config: makeConfig({ modules: envModules }) })
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
    const formLink = screen.getByRole('link', { name: 'Incident Form' })
    expect(formLink).toHaveAttribute('href', '/module/protected/app/incident-form')
    expect(formLink).toHaveClass('workspace-menu-child--form', 'is-active')
    expect(screen.getAllByRole('link', { name: 'Incident Form' })).toHaveLength(1)
  })

  it('shows the signed-in user and logs out to /login', async () => {
    const signOut = vi.fn(async () => {})
    renderShell(sidebar, {
      path: '/module/roads/app/network',
      auth: makeAuth({ signOut }),
      routes: <Route path="/login" element={<p>login screen</p>} />,
    })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    await waitFor(() => expect(screen.getByText('login screen')).toBeInTheDocument())
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('omits the account row when no user name is known', () => {
    renderShell(sidebar, { auth: makeAuth({ user: null }) })
    expect(screen.queryByText('AL')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })
})

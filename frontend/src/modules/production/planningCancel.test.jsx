// @vitest-environment jsdom
// Production Planning: Cancel is disabled (with a tooltip) for a PRD that
// already has production log rows; still active for one that has none.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const { PLANS, cancel, none } = vi.hoisted(() => ({
  PLANS: [
    { prd_no: 'PRD-009', customer_order_no: 'PRD-009', prd_qty: 10, po_number: 'PO-1', status: 'Planned', can_cancel: true, has_production_logs: true },
    { prd_no: 'PRD-010', customer_order_no: 'PRD-010', prd_qty: 20, po_number: 'PO-1', status: 'Planned', can_cancel: true, has_production_logs: false },
    { prd_no: 'PRD-011', customer_order_no: 'PRD-011', prd_qty: 30, po_number: 'PO-2', status: 'In Progress', can_cancel: false, has_production_logs: true },
  ],
  cancel: vi.fn(),
  none: async () => [],
}))
vi.mock('../../data/queries/productionPlanning', () => ({ listOrdersAvailableForPlanning: async () => [], listProductionPlans: async () => PLANS }))
vi.mock('../../data/queries/productionBatch', () => ({ listProductionBatches: none }))
vi.mock('../../data/queries/customers', () => ({ listCustomers: none }))
vi.mock('../../data/queries/customerPoHeaders', () => ({ listPoHeaders: none }))
vi.mock('../../data/queries/products', () => ({ listProducts: none }))
vi.mock('../../data/queries/routeCards', () => ({ planProductionOrders: vi.fn(), cancelProductionOrder: (...a) => cancel(...a) }))
vi.mock('../../data/queries/rawMaterialStock', () => ({ listRawMaterialStockBalance: none }))
vi.mock('../../data/queries/rawMaterials', () => ({ listRawMaterials: none }))
vi.mock('../../data/queries/productRawMaterials', () => ({ listAllProductRawMaterials: none }))

import ProductionPlanningScreen from './ProductionPlanningScreen'

afterEach(() => { cleanup(); cancel.mockReset() })

describe('Production Planning Cancel', () => {
  it('disabled with the tooltip when production logs exist; active otherwise; hidden once stages started', async () => {
    render(<ProductionPlanningScreen />)
    const started = await screen.findByRole('button', { name: "Cancel PRD-009: Production has started -- can't cancel" })
    expect(started.disabled).toBe(true)
    expect(started.getAttribute('title')).toBe("Production has started -- can't cancel")
    fireEvent.click(started)
    expect(cancel).not.toHaveBeenCalled()

    // the list shows its first rows only until expanded
    const more = screen.queryByRole('button', { name: /show all|more/i })
    if (more) fireEvent.click(more)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Cancel/ })).toHaveLength(2))
    const active = screen.getAllByRole('button', { name: /Cancel/ }).find((b) => !b.disabled)
    expect(active.closest('tr').textContent).toContain('PRD-010')
    expect(active.getAttribute('title')).toBeNull()
  })
})

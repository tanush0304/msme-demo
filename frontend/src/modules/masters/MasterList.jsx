import {
  Award,
  Barcode,
  Box,
  Boxes,
  Clock,
  Cog,
  Factory,
  Handshake,
  Route,
  Timer,
  Truck,
  Users,
  UsersRound,
  Warehouse,
  Wrench,
} from 'lucide-react'
import PageHeader, { PageHeaderBandProvider } from '../../components/PageHeader'
import ModuleCard from '../../components/ModuleCard'
import { NAV_ITEMS } from '../../utils/constants'
import { rotatedTheme } from '../../theme/moduleTheme'
import CustomerMaster from './CustomerMaster'
import ProductMaster from './ProductMaster'
import MachineMaster from './MachineMaster'
import JobWorkMaster from './JobWorkMaster'
import CycleTimeMaster from './CycleTimeMaster'
import RawMaterialMaster from './RawMaterialMaster'
import SupplierMaster from './SupplierMaster'
import ShiftMaster from './ShiftMaster'
import EmployeeMaster from './EmployeeMaster'
import VendorMaster from './VendorMaster'
import QualityMaster from './QualityMaster'
import MaintenanceMaster from './MaintenanceMaster'
import ProductionBatchMaster from './ProductionBatchMaster'
import RouteCardScreen from '../customerOrder/RouteCardScreen'
import FinishedGoodsMaster from './FinishedGoodsMaster'
import WipMaster from './WipMaster'

const MASTER_COMPONENTS = {
  product: ProductMaster,
  machine: MachineMaster,
  'job-work': JobWorkMaster,
  'cycle-time': CycleTimeMaster,
  customer: CustomerMaster,
  'raw-material': RawMaterialMaster,
  supplier: SupplierMaster,
  shift: ShiftMaster,
  employee: EmployeeMaster,
  vendor: VendorMaster,
  quality: QualityMaster,
  maintenance: MaintenanceMaster,
  'production-batch': ProductionBatchMaster,
  'route-card': RouteCardScreen,
  'finished-goods': FinishedGoodsMaster,
  wip: WipMaster,
}

// Icon + two-line description per master. Card colours rotate through the 8
// module accents (theme/moduleTheme.js), in tile order.
const MASTER_PRESENTATION = {
  employee: { icon: Users, description: 'Manage employee details, roles and skills' },
  customer: { icon: UsersRound, description: 'Manage customer details and contact information' },
  product: { icon: Box, description: 'Manage product details and specifications' },
  supplier: { icon: Truck, description: 'Manage supplier details and contact information' },
  'raw-material': { icon: Boxes, description: 'Manage raw material details and specifications' },
  vendor: { icon: Handshake, description: 'Manage vendor details and contact information' },
  quality: { icon: Award, description: 'Manage quality parameters and inspection standards' },
  machine: { icon: Factory, description: 'Manage machine details and specifications' },
  'job-work': { icon: Cog, description: 'Manage jobwork vendor details and operations' },
  'cycle-time': { icon: Timer, description: 'Manage standard cycle times for operations' },
  shift: { icon: Clock, description: 'Manage shift details and timings' },
  'production-batch': { icon: Barcode, description: 'Manage production batch details and parameters' },
  maintenance: { icon: Wrench, description: 'Manage maintenance details and schedules' },
  'finished-goods': { icon: Warehouse, description: 'Manage finished goods store details and parameters' },
  wip: { icon: Warehouse, description: 'Manage work in progress store details and parameters' },
  'route-card': { icon: Route, description: 'Manage operation sequences and routing details' },
}

const MASTER_NAV = NAV_ITEMS.find((item) => item.key === 'masters')?.subItems ?? []

export const MASTER_ENTRIES = MASTER_NAV.map((item, i) => ({
  ...item,
  ...MASTER_PRESENTATION[item.key],
  theme: rotatedTheme(i),
  component: MASTER_COMPONENTS[item.key],
}))

// Shared landing card in the entry's rotated colour. Title is the same label the
// sidebar uses (constants.js).
export function MasterCard({ item, onSelect }) {
  return (
    <ModuleCard
      title={item.label}
      description={item.description}
      icon={item.icon}
      theme={item.theme}
      onClick={() => onSelect(item.key)}
      compact
    />
  )
}

function MastersLanding({ onSelect }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        eyebrow="Master Data"
        title="Masters"
        size="lg"
      />
      {/* Compact cards: 4 columns from 1400px (4x4, one screen at 1440x900),
          3 from xl, 2 from md, 1 on phones. Rows take their content height,
          so nothing is clipped; the page scrolls when the cards don't fit. */}
      <main className="flex-1 overflow-y-auto bg-page px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-[1400px]:grid-cols-4">
            {MASTER_ENTRIES.map((item) => (
              <MasterCard key={item.key} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// With no selected submenu, show the selector. Sidebar submenu clicks open
// the same screen component as selecting its card.
export default function MasterList({ activeTab, onSelect }) {
  const entity = MASTER_ENTRIES.find((item) => item.key === activeTab)
  if (!entity) {
    return (
      <PageHeaderBandProvider breadcrumb={[{ label: 'Masters' }]}>
        <MastersLanding onSelect={onSelect} />
      </PageHeaderBandProvider>
    )
  }

  const Screen = entity.component
  return (
    <PageHeaderBandProvider breadcrumb={[{ label: 'Masters', onClick: () => onSelect(null) }, { label: entity.label }]}>
      <Screen />
    </PageHeaderBandProvider>
  )
}

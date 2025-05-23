// Required modules
const {faker} = require('@faker-js/faker')
const fs = require('fs')
const path = require('path')
const {startOfMonth, endOfMonth, subMonths} = require('date-fns')

// --- CONFIGURATION ---
const config = {
  numVehicles: parseInt(process.argv[2], 10) || 100,
  numEmployees: parseInt(process.argv[3], 10) || 200,
  numDeliveries: parseInt(process.argv[4], 10) || 500,
  // Probability that an employee has at least one vehicle assigned
  employeeHasVehicleProb: 0.7,
  // Probability that a vehicle is assigned to at least one employee
  vehicleHasEmployeeProb: 0.8,
  // Max number of vehicles per employee
  maxVehiclesPerEmployee: 3,
  // Max number of employees per vehicle
  maxEmployeesPerVehicle: 4,

  // Output file
  outputFile: path.join(__dirname, 'output', `seed-${Date.now()}.sql`),
}

// --- ENUMS (from schema) ---
const employeeRoles = ['driver', 'dispatcher', 'manager']
const employeeStatuses = ['active', 'on leave', 'inactive']
const vehicleTypes = ['truck', 'van', 'car']
const vehicleStatuses = ['available', 'on delivery', 'maintenance', 'offline']
const deliveryStatuses = ['pending', 'active', 'completed', 'cancelled']

// --- SQL SCHEMA (copied from init.sql, no changes) ---
const schemaSQL = `
-- Drop tables and types if they exist (for repeatability, optional)
DROP TABLE IF EXISTS vehicle_employee CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TYPE IF EXISTS employee_role;
DROP TYPE IF EXISTS employee_status;
DROP TYPE IF EXISTS vehicle_type;
DROP TYPE IF EXISTS vehicle_status;
DROP TYPE IF EXISTS delivery_status;

-- Create custom enum types
CREATE TYPE employee_role AS ENUM ('driver', 'dispatcher', 'manager');
CREATE TYPE employee_status AS ENUM ('active', 'on leave', 'inactive');
CREATE TYPE vehicle_type AS ENUM ('truck', 'van', 'car');
CREATE TYPE vehicle_status AS ENUM ('available', 'on delivery', 'maintenance', 'offline');
CREATE TYPE delivery_status AS ENUM ('pending', 'active', 'completed', 'cancelled');

-- Employee table (no reference to current_vehicle)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role employee_role NOT NULL,
    status employee_status NOT NULL,
    contact_email VARCHAR(255) UNIQUE NOT NULL,
    hire_date DATE NOT NULL
);

-- Vehicle table (no reference to current_driver)
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    type vehicle_type NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    status vehicle_status NOT NULL,
    last_maintenance_date DATE
);

-- Vehicle-Employee association table with additional columns
CREATE TABLE vehicle_employee (
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    since_date DATE NOT NULL,
    planned_leave_date DATE,
    usage_notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    last_inspection_date DATE,
    PRIMARY KEY (vehicle_id, employee_id, since_date)
);

-- Deliveries table (New table)
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id INT REFERENCES employees(id) ON DELETE SET NULL,
    status delivery_status NOT NULL DEFAULT 'pending',
    scheduled_delivery_time TIMESTAMPTZ,
    actual_pickup_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    delivery_distance_miles NUMERIC(8, 2),
    fuel_consumed_gallons NUMERIC(6, 2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`

// --- DATA GENERATION ---
function randomEnum(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(start, end) {
  return faker.date.between({from: start, to: end})
}

// Generate employees
function generateEmployees(n) {
  const employees = []
  const emails = new Set()
  for (let i = 0; i < n; i++) {
    let email
    do {
      email = faker.internet
        .email({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
        })
        .toLowerCase()
    } while (emails.has(email))
    emails.add(email)
    employees.push({
      id: i + 1,
      name: faker.person.fullName(),
      role: randomEnum(employeeRoles),
      status: randomEnum(employeeStatuses),
      contact_email: email,
      hire_date: faker.date.past({years: 10, refDate: '2025-01-01'}).toISOString().slice(0, 10),
    })
  }
  return employees
}

// Generate vehicles
function generateVehicles(n) {
  const vehicles = []
  const plates = new Set()
  for (let i = 0; i < n; i++) {
    let plate
    do {
      plate =
        faker.string.alphanumeric({length: 3, casing: 'upper'}) + '-' + faker.string.numeric(3)
    } while (plates.has(plate))
    plates.add(plate)
    vehicles.push({
      id: i + 1,
      type: randomEnum(vehicleTypes),
      license_plate: plate,
      status: randomEnum(vehicleStatuses),
      last_maintenance_date: faker.date
        .past({years: 2, refDate: '2025-05-01'})
        .toISOString()
        .slice(0, 10),
    })
  }
  return vehicles
}

// Helper function to get date ranges for current and previous month
function getMonthDateRanges() {
  const now = new Date()
  const startOfCurrentMonth = startOfMonth(now)
  const endOfCurrentMonth = endOfMonth(now)
  const prevMonthDate = subMonths(now, 1)
  const startOfPreviousMonth = startOfMonth(prevMonthDate)
  const endOfPreviousMonth = endOfMonth(prevMonthDate)

  return {
    currentMonth: {start: startOfCurrentMonth, end: now, fullEnd: endOfCurrentMonth},
    previousMonth: {
      start: startOfPreviousMonth,
      end: endOfPreviousMonth,
      fullEnd: endOfPreviousMonth,
    },
  }
}

// Generate deliveries
function generateDeliveries(numDeliveries, vehicles, employees, dateRanges) {
  const deliveries = []
  const drivers = employees.filter(emp => emp.role === 'driver')
  if (drivers.length === 0) {
    console.warn('No drivers available to assign to deliveries. Skipping delivery generation.')
    return []
  }
  if (vehicles.length === 0) {
    console.warn('No vehicles available to assign to deliveries. Skipping delivery generation.')
    return []
  }

  const {previousMonth, currentMonth} = dateRanges

  const numPrevMonthDeliveries = Math.floor(numDeliveries / 2)
  const numCurrMonthDeliveries = numDeliveries - numPrevMonthDeliveries

  let deliveryIdCounter = 1

  const createDeliverySet = (count, monthRange, isCurrentMonth) => {
    for (let i = 0; i < count; i++) {
      const vehicle = randomEnum(vehicles)
      const driver = randomEnum(drivers)
      const status = randomEnum(deliveryStatuses)

      const createdAt = faker.date.between({from: monthRange.start, to: monthRange.end})

      let scheduledDeliveryTime
      let actual_pickup_time = null
      let actualDeliveryTime = null
      let deliveryDistanceMiles = null
      let fuelConsumedGallons = null

      if (status === 'completed') {
        // 1. Determine actual_pickup_time: 1-12 hours after creation
        let tempPickupTime = new Date(
          createdAt.getTime() + faker.number.int({min: 1 * 3600 * 1000, max: 12 * 3600 * 1000}),
        )
        if (tempPickupTime > monthRange.fullEnd) tempPickupTime = monthRange.fullEnd
        if (tempPickupTime <= createdAt)
          tempPickupTime = new Date(createdAt.getTime() + 3600 * 1000) // Ensure at least 1hr after creation
        actual_pickup_time = tempPickupTime

        // 2. Determine actual delivery duration (1-2 days)
        const deliveryDurationMs = faker.number.int({min: 24 * 3600 * 1000, max: 48 * 3600 * 1000})
        const baseActualDeliveryTime = new Date(actual_pickup_time.getTime() + deliveryDurationMs)

        // 3. Set scheduled_delivery_time and final actualDeliveryTime based on on-time/late criteria
        const isOnTime = Math.random() < 0.95 // 95% on-time rate
        if (isOnTime) {
          actualDeliveryTime = baseActualDeliveryTime
          const bufferMs = faker.number.int({min: 0, max: 8 * 3600 * 1000}) // Scheduled can be 0-8 hours after actual
          scheduledDeliveryTime = new Date(actualDeliveryTime.getTime() + bufferMs)
        } else {
          // 5% LATE
          actualDeliveryTime = baseActualDeliveryTime
          const shortfallMs = faker.number.int({min: 1 * 3600 * 1000, max: 8 * 3600 * 1000}) // Scheduled was 1-8 hours before actual
          scheduledDeliveryTime = new Date(actualDeliveryTime.getTime() - shortfallMs)
        }

        // 4. Adjustments and Caps: Ensure chronological order and within month boundaries
        if (scheduledDeliveryTime <= actual_pickup_time) {
          scheduledDeliveryTime = new Date(
            actual_pickup_time.getTime() +
              faker.number.int({min: 1 * 3600 * 1000, max: 2 * 3600 * 1000}),
          ) // Ensure scheduled is after pickup
        }
        if (actualDeliveryTime <= actual_pickup_time) {
          actualDeliveryTime = new Date(actual_pickup_time.getTime() + deliveryDurationMs) // Recalculate if somehow pickup was too late
        }

        // Cap all times to the end of the month
        actual_pickup_time = new Date(
          Math.min(actual_pickup_time.getTime(), monthRange.fullEnd.getTime()),
        )
        scheduledDeliveryTime = new Date(
          Math.min(scheduledDeliveryTime.getTime(), monthRange.fullEnd.getTime()),
        )
        actualDeliveryTime = new Date(
          Math.min(actualDeliveryTime.getTime(), monthRange.fullEnd.getTime()),
        )

        // Ensure minimum viable time differences
        if (actual_pickup_time <= createdAt)
          actual_pickup_time = new Date(createdAt.getTime() + 60000) // min 1 minute after creation
        if (scheduledDeliveryTime <= actual_pickup_time)
          scheduledDeliveryTime = new Date(actual_pickup_time.getTime() + 60000) // min 1 minute after pickup
        if (actualDeliveryTime <= actual_pickup_time)
          actualDeliveryTime = new Date(actual_pickup_time.getTime() + 60000) // min 1 minute after pickup

        // Specific adjustments for previous month data to not have future dates
        if (!isCurrentMonth) {
          const prevMonthEffectiveEnd = monthRange.end // For previous month, 'end' is the true end

          if (actualDeliveryTime > prevMonthEffectiveEnd) actualDeliveryTime = prevMonthEffectiveEnd

          // If actualDeliveryTime was capped, actual_pickup_time might need adjustment too
          if (actual_pickup_time >= actualDeliveryTime) {
            let candidatePickup = new Date(actualDeliveryTime.getTime() - deliveryDurationMs) // try to maintain duration
            // Ensure pickup is after creation and not after the effective end of the month
            actual_pickup_time = new Date(
              Math.max(candidatePickup.getTime(), createdAt.getTime() + 3600 * 1000),
            )
            if (actual_pickup_time > prevMonthEffectiveEnd)
              actual_pickup_time = prevMonthEffectiveEnd
          }

          if (scheduledDeliveryTime > prevMonthEffectiveEnd)
            scheduledDeliveryTime = prevMonthEffectiveEnd
          // Ensure scheduled time is after pickup and within month
          if (scheduledDeliveryTime <= actual_pickup_time) {
            scheduledDeliveryTime = new Date(actual_pickup_time.getTime() + 3600 * 1000) // min 1hr after pickup
            if (scheduledDeliveryTime > prevMonthEffectiveEnd)
              scheduledDeliveryTime = prevMonthEffectiveEnd
          }
        }

        deliveryDistanceMiles = faker.number.float({min: 5, max: 200, fractionDigits: 2})
        fuelConsumedGallons = faker.number.float({
          min: deliveryDistanceMiles / 25, // Min 5 MPG
          max: deliveryDistanceMiles / 5, // Max 25 MPG
          fractionDigits: 2,
        })
        if (fuelConsumedGallons <= 0 && deliveryDistanceMiles > 0)
          fuelConsumedGallons = 0.1 // Ensure positive fuel for completed trips
        else if (deliveryDistanceMiles === 0) fuelConsumedGallons = 0
      } else if (status === 'active') {
        // Scheduled time: 1-3 days after creation
        scheduledDeliveryTime = new Date(
          createdAt.getTime() + faker.number.int({min: 24 * 3600 * 1000, max: 72 * 3600 * 1000}),
        )
        if (scheduledDeliveryTime > monthRange.fullEnd) scheduledDeliveryTime = monthRange.fullEnd
        if (scheduledDeliveryTime <= createdAt)
          scheduledDeliveryTime = new Date(createdAt.getTime() + 24 * 3600 * 1000) // Min 1 day

        // 90% of active deliveries have an actual_pickup_time
        if (Math.random() < 0.9) {
          // Pickup time should be between createdAt and (min of scheduledDeliveryTime or month end for active)
          const latestPossiblePickupForActive = isCurrentMonth
            ? monthRange.end
            : Math.min(scheduledDeliveryTime.getTime(), monthRange.end.getTime())
          if (createdAt.getTime() < latestPossiblePickupForActive) {
            actual_pickup_time = faker.date.between({
              from: createdAt,
              to: new Date(latestPossiblePickupForActive),
            })
          } else {
            // If createdAt is already too close to latestPossiblePickup, add a small window
            actual_pickup_time = new Date(
              createdAt.getTime() + faker.number.int({min: 1 * 3600 * 1000, max: 3 * 3600 * 1000}),
            )
          }
          // Cap pickup time to the effective end of the month
          if (actual_pickup_time > monthRange.end) actual_pickup_time = monthRange.end
          if (actual_pickup_time <= createdAt)
            actual_pickup_time = new Date(createdAt.getTime() + 3600 * 1000) // Ensure at least 1hr after creation
        }

        // 70% of active deliveries (that have a pickup time) have some distance/fuel
        if (actual_pickup_time && Math.random() < 0.7) {
          deliveryDistanceMiles = faker.number.float({min: 1, max: 100, fractionDigits: 2})
          fuelConsumedGallons = faker.number.float({
            min: deliveryDistanceMiles / 25,
            max: deliveryDistanceMiles / 5,
            fractionDigits: 2,
          })
          if (fuelConsumedGallons <= 0 && deliveryDistanceMiles > 0) fuelConsumedGallons = 0.1
          else if (deliveryDistanceMiles === 0) fuelConsumedGallons = 0
        }
      } else {
        // 'pending' or 'cancelled'
        // Scheduled time: 1-3 days after creation
        scheduledDeliveryTime = new Date(
          createdAt.getTime() + faker.number.int({min: 24 * 3600 * 1000, max: 72 * 3600 * 1000}),
        )
        if (scheduledDeliveryTime > monthRange.fullEnd) scheduledDeliveryTime = monthRange.fullEnd
        if (scheduledDeliveryTime <= createdAt)
          scheduledDeliveryTime = new Date(createdAt.getTime() + 24 * 3600 * 1000) // Min 1 day
      }

      // Fallback for scheduledDeliveryTime if somehow not set (should not happen)
      if (!scheduledDeliveryTime) {
        scheduledDeliveryTime = new Date(
          createdAt.getTime() + faker.number.int({min: 24 * 3600 * 1000, max: 72 * 3600 * 1000}),
        )
        if (scheduledDeliveryTime > monthRange.fullEnd) scheduledDeliveryTime = monthRange.fullEnd
        if (scheduledDeliveryTime <= createdAt)
          scheduledDeliveryTime = new Date(createdAt.getTime() + 24 * 3600 * 1000)
      }

      deliveries.push({
        id: deliveryIdCounter++,
        vehicle_id: vehicle.id,
        driver_id: driver.id,
        status: status,
        scheduled_delivery_time: scheduledDeliveryTime.toISOString(),
        actual_pickup_time: actual_pickup_time ? actual_pickup_time.toISOString() : null,
        actual_delivery_time: actualDeliveryTime ? actualDeliveryTime.toISOString() : null,
        delivery_distance_miles: deliveryDistanceMiles,
        fuel_consumed_gallons: fuelConsumedGallons,
        created_at: createdAt.toISOString(),
      })
    }
  }

  createDeliverySet(numPrevMonthDeliveries, previousMonth, false)
  createDeliverySet(numCurrMonthDeliveries, currentMonth, true)

  return deliveries
}

// Generate vehicle-employee associations
function generateAssociations(employees, vehicles, config) {
  const associations = []
  // Map to track which vehicles/employees are already associated
  const employeeToVehicles = new Map()
  const vehicleToEmployees = new Map()

  // Assign vehicles to employees based on probability
  employees.forEach(emp => {
    if (Math.random() < config.employeeHasVehicleProb) {
      const numVehicles = 1 + Math.floor(Math.random() * config.maxVehiclesPerEmployee)
      const vehicleIds = faker.helpers.arrayElements(
        vehicles.map(v => v.id),
        Math.min(numVehicles, vehicles.length),
      )
      vehicleIds.forEach(vehicleId => {
        const since_date = faker.date
          .between({from: emp.hire_date, to: '2025-05-01'})
          .toISOString()
          .slice(0, 10)
        const planned_leave_date =
          Math.random() < 0.2
            ? faker.date.future({years: 1, refDate: since_date}).toISOString().slice(0, 10)
            : null
        const usage_notes = faker.lorem.sentence()
        const is_primary = Math.random() < 0.5
        const last_inspection_date = faker.date
          .between({from: since_date, to: '2025-05-15'})
          .toISOString()
          .slice(0, 10)
        associations.push({
          vehicle_id: vehicleId,
          employee_id: emp.id,
          since_date,
          planned_leave_date,
          usage_notes,
          is_primary,
          last_inspection_date,
        })
        // Track associations
        if (!employeeToVehicles.has(emp.id)) employeeToVehicles.set(emp.id, new Set())
        employeeToVehicles.get(emp.id).add(vehicleId)
        if (!vehicleToEmployees.has(vehicleId)) vehicleToEmployees.set(vehicleId, new Set())
        vehicleToEmployees.get(vehicleId).add(emp.id)
      })
    }
  })

  // Ensure vehicles have employees based on probability
  vehicles.forEach(vehicle => {
    if (
      (vehicleToEmployees.get(vehicle.id)?.size || 0) === 0 &&
      Math.random() < config.vehicleHasEmployeeProb
    ) {
      const numEmployees = 1 + Math.floor(Math.random() * config.maxEmployeesPerVehicle)
      const employeeIds = faker.helpers.arrayElements(
        employees.map(e => e.id),
        Math.min(numEmployees, employees.length),
      )
      employeeIds.forEach(employeeId => {
        // Avoid duplicate association
        if (associations.some(a => a.vehicle_id === vehicle.id && a.employee_id === employeeId))
          return
        const since_date = faker.date
          .past({years: 2, refDate: '2025-05-01'})
          .toISOString()
          .slice(0, 10)
        const planned_leave_date =
          Math.random() < 0.2
            ? faker.date.future({years: 1, refDate: since_date}).toISOString().slice(0, 10)
            : null
        const usage_notes = faker.lorem.sentence()
        const is_primary = Math.random() < 0.5
        const last_inspection_date = faker.date
          .between({from: since_date, to: '2025-05-15'})
          .toISOString()
          .slice(0, 10)
        associations.push({
          vehicle_id: vehicle.id,
          employee_id: employeeId,
          since_date,
          planned_leave_date,
          usage_notes,
          is_primary,
          last_inspection_date,
        })
      })
    }
  })

  return associations
}

// --- SQL GENERATION ---
function toSQLInsert(table, rows, columns) {
  if (rows.length === 0) return ''
  const values = rows
    .map(
      row =>
        '(' +
        columns
          .map(col => {
            const val = row[col]
            if (val === null || val === undefined) return 'NULL'
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
            if (typeof val === 'number') return val
            return `'${String(val).replace(/'/g, "''")}'`
          })
          .join(', ') +
        ')',
    )
    .join(',\n')
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};\n`
}

// --- MAIN ---
function main() {
  // Generate data
  const employees = generateEmployees(config.numEmployees)
  const vehicles = generateVehicles(config.numVehicles)
  const associations = generateAssociations(employees, vehicles, config)
  const dateRanges = getMonthDateRanges()
  const deliveries = generateDeliveries(config.numDeliveries, vehicles, employees, dateRanges)

  // Generate SQL
  let sql = schemaSQL + '\n'
  sql += toSQLInsert('employees', employees, [
    'id',
    'name',
    'role',
    'status',
    'contact_email',
    'hire_date',
  ])
  sql += '\n'
  sql += toSQLInsert('vehicles', vehicles, [
    'id',
    'type',
    'license_plate',
    'status',
    'last_maintenance_date',
  ])
  sql += '\n'
  sql += toSQLInsert('vehicle_employee', associations, [
    'vehicle_id',
    'employee_id',
    'since_date',
    'planned_leave_date',
    'usage_notes',
    'is_primary',
    'last_inspection_date',
  ])
  sql += '\n'
  sql += toSQLInsert('deliveries', deliveries, [
    'id',
    'vehicle_id',
    'driver_id',
    'status',
    'scheduled_delivery_time',
    'actual_pickup_time',
    'actual_delivery_time',
    'delivery_distance_miles',
    'fuel_consumed_gallons',
    'created_at',
  ])

  // Write to file
  fs.writeFileSync(config.outputFile, sql)
  console.log(`Seed SQL written to ${config.outputFile}`)
}

main()

import Link from "next/link";
import { AppointmentForm } from "@/component/AppointmentForm";
import { AppointmentStatusBadge } from "@/component/AppointmentStatusBadge";
import {
  APPOINTMENT_TABLE_COLUMNS,
  APPOINTMENT_TYPES,
  listAppointments,
  toAppointmentRow,
} from "@/lib/appointments/booking";
import { prisma } from "@/lib/db";
import { localDateInTimeZone } from "@/lib/followups/schedule";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";
import "../campaigns/campaigns.css";
import "./appointments.css";

export default async function AppointmentsPage() {
  const { business } = await getCurrentWorkspace();
  const timezone = business.timezone || "Asia/Kolkata";

  const [appointments, leads] = await Promise.all([
    listAppointments(business.id),
    prisma.lead.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    }),
  ]);
  const rows = appointments.map((a) => toAppointmentRow(a, timezone));

  return (
    <>
      <header className="dash-header">
        <h1>Appointments</h1>
        <p>
          Counselling, demo and consultation bookings made by you or your AI agent. Only
          free slots inside your calling hours can be booked.
        </p>
      </header>

      <section className="dash-panel">
        <h2>All appointments</h2>
        {rows.length === 0 ? (
          <div className="campaign-empty">
            <strong>No appointments yet</strong>
            <p>Book one below, or let your AI agent book it during a call.</p>
          </div>
        ) : (
          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  {APPOINTMENT_TABLE_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/dashboard/appointments/${row.id}`}
                        className="campaign-table-name"
                      >
                        {row.customer}
                      </Link>
                    </td>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    <td>{row.type}</td>
                    <td>
                      <AppointmentStatusBadge status={row.statusValue} />
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/appointments/${row.id}`}
                        className="campaign-table-action"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-panel">
        <h2>Book appointment</h2>
        <AppointmentForm
          leads={leads.map((l) => ({ id: l.id, name: `${l.name} (${l.phone})` }))}
          types={APPOINTMENT_TYPES}
          today={localDateInTimeZone(new Date(), timezone)}
          timezone={timezone}
        />
      </section>
    </>
  );
}

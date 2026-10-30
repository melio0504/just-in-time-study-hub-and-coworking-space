import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatReportPeriod,
  type ReportBooking,
  type ReportMetric,
  type ReportPeriod,
  type ReportWalkIn,
  summarizeReport,
} from "./business-reports";

type ExportInput = {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  metrics: ReportMetric[];
  bookings: ReportBooking[];
  walkIns: ReportWalkIn[];
  activeMembers: number;
};

const money = (centavos: number | null) =>
  `PHP ${Math.round((centavos ?? 0) / 100).toLocaleString("en-PH")}`;
const hours = (value: number) => `${value.toFixed(1)}h`;
const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const duration = (minutes: number | null) => {
  if (!minutes) return "—";
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${wholeHours ? `${wholeHours}h ` : ""}${remainder ? `${remainder}m` : ""}`.trim();
};

async function loadLogo() {
  try {
    const response = await fetch("/images/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportBusinessReportPdf(input: ExportInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const logo = await loadLogo();
  const summary = summarizeReport(input.metrics);
  const periodLabel = formatReportPeriod(input.period, input.startDate, input.endDate);
  const reportTitle = `${input.period[0].toUpperCase()}${input.period.slice(1)} Business Report`;
  const paidWalkIns = input.walkIns.filter(
    (item) => item.status === "completed" && item.payment_status === "paid",
  );
  const completedWalkIns = input.walkIns.filter((item) => item.status === "completed");
  const averageStay = completedWalkIns.length
    ? completedWalkIns.reduce((sum, item) => sum + (item.billable_minutes ?? 0), 0) /
      completedWalkIns.length
    : 0;
  const averageTicket = summary.visits ? summary.revenue / summary.visits : 0;
  const walkInShare = summary.revenue
    ? Math.round((summary.walkInRevenue / summary.revenue) * 100)
    : 0;
  const collectionBase =
    paidWalkIns.reduce((sum, item) => sum + (item.charged_amount_cents ?? 0), 0) +
    summary.outstanding;
  const collectionRate = collectionBase
    ? Math.round((summary.walkInRevenue / collectionBase) * 100)
    : 100;

  const addHeader = (pageNumber: number, totalPages: number) => {
    doc.setFillColor(255, 252, 247);
    doc.rect(0, 0, 210, 29, "F");
    if (logo) doc.addImage(logo, "PNG", 14, 6, 27, 15);
    doc.setTextColor(45, 37, 32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Just In Time Study Hub and Coworking Space", 46, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(95, 82, 72);
    doc.text(`${reportTitle} · ${periodLabel}`, 46, 18);
    doc.setDrawColor(229, 169, 48);
    doc.line(14, 25, 196, 25);
    doc.setFontSize(7);
    doc.text(
      `Generated ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`,
      14,
      291,
    );
    doc.text(`Page ${pageNumber} of ${totalPages}`, 196, 291, { align: "right" });
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(45, 37, 32);
  doc.text(reportTitle, 14, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(95, 82, 72);
  doc.text(periodLabel, 14, 46);

  const cards = [
    ["Total revenue", money(summary.revenue)],
    ["Customers served", summary.visits.toLocaleString("en-PH")],
    ["Reservations", summary.reservations.toLocaleString("en-PH")],
    ["Walk-ins", summary.walkIns.toLocaleString("en-PH")],
    ["Average daily revenue", money(summary.averageDailyRevenue)],
    ["Average ticket", money(averageTicket)],
    ["Seat utilization", `${summary.occupancy}%`],
    ["Outstanding walk-ins", money(summary.outstanding)],
  ];
  cards.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 14 + column * 92;
    const y = 54 + row * 18;
    doc.setFillColor(255, 249, 236);
    doc.roundedRect(x, y, 86, 14, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 94, 82);
    doc.text(label.toUpperCase(), x + 4, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(45, 37, 32);
    doc.text(value, x + 4, y + 11);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Owner insights", 14, 132);
  const insightRows = [
    [
      "Busiest day",
      summary.busiest
        ? `${dateLabel(summary.busiest.report_date)} (${summary.busiest.total_visits} visits)`
        : "No activity",
    ],
    [
      "Revenue mix",
      `${money(summary.reservationRevenue)} reservations · ${money(summary.walkInRevenue)} walk-ins (${walkInShare}% of revenue)`,
    ],
    [
      "Walk-in operations",
      `${completedWalkIns.length} completed · ${duration(Math.round(averageStay))} average stay · ${collectionRate}% collection rate`,
    ],
    [
      "Payment mix",
      `${money(summary.cash)} cash · ${money(summary.qrph)} QRPH · ${money(summary.other)} other`,
    ],
    [
      "Capacity",
      `${hours(summary.occupiedHours)} occupied of ${hours(summary.availableHours)} available seat-hours`,
    ],
    ["Customer base", `${input.activeMembers.toLocaleString("en-PH")} active customer accounts`],
  ];
  autoTable(doc, {
    startY: 137,
    head: [["Business indicator", "Result"]],
    body: insightRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [232, 223, 212], lineWidth: 0.2 },
    headStyles: { fillColor: [45, 37, 32], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42 } },
    margin: { top: 32, right: 14, bottom: 16, left: 14 },
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(45, 37, 32);
  doc.text("Daily performance", 14, 37);
  autoTable(doc, {
    startY: 42,
    head: [
      [
        "Date",
        "Revenue",
        "Reservations",
        "Walk-ins",
        "Visits",
        "Check-ins",
        "Occupied hrs",
        "Utilization",
      ],
    ],
    body: input.metrics.map((metric) => [
      dateLabel(metric.report_date),
      money(metric.revenue_cents),
      metric.reservation_count,
      metric.walk_in_count,
      metric.total_visits,
      metric.checkins_count,
      hours(Number(metric.occupied_seat_hours)),
      `${metric.available_seat_hours ? Math.round((Number(metric.occupied_seat_hours) / Number(metric.available_seat_hours)) * 100) : 0}%`,
    ]),
    theme: "striped",
    styles: { fontSize: 6.8, cellPadding: 1.8 },
    headStyles: { fillColor: [196, 132, 26], textColor: 255 },
    margin: { top: 32, right: 9, bottom: 16, left: 9 },
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Reservation records", 14, 37);
  autoTable(doc, {
    startY: 42,
    head: [["Date", "Code", "Customer", "Seats", "Hours", "Status", "Payment", "Amount"]],
    body: input.bookings.map((booking) => [
      dateLabel(booking.booking_date),
      booking.reservation_code,
      booking.guest_name,
      booking.seat_ids.join(", "),
      booking.duration_hours,
      booking.status.replaceAll("_", " "),
      booking.payment_status.replaceAll("_", " "),
      money(booking.subtotal_cents),
    ]),
    theme: "striped",
    styles: { fontSize: 6.5, cellPadding: 1.7 },
    headStyles: { fillColor: [45, 37, 32], textColor: 255 },
    margin: { top: 32, right: 8, bottom: 16, left: 8 },
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Walk-in service records", 14, 37);
  autoTable(doc, {
    startY: 42,
    head: [["Date", "Customer", "Seat", "Service", "Stay", "Status", "Payment", "Amount"]],
    body: input.walkIns.map((walkIn) => [
      dateLabel(walkIn.business_date),
      walkIn.guest_name || "Walk-in guest",
      walkIn.seat?.code ?? "—",
      walkIn.service_name ?? "Legacy / unpriced",
      duration(walkIn.billable_minutes),
      walkIn.status,
      `${walkIn.payment_method ?? "—"} · ${walkIn.payment_status}`,
      money(walkIn.charged_amount_cents),
    ]),
    theme: "striped",
    styles: { fontSize: 6.5, cellPadding: 1.7 },
    headStyles: { fillColor: [229, 169, 48], textColor: [45, 37, 32] },
    margin: { top: 32, right: 8, bottom: 16, left: 8 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addHeader(page, totalPages);
  }

  const filenamePeriod = `${input.startDate}${input.endDate === input.startDate ? "" : `_to_${input.endDate}`}`;
  doc.save(`jit-study-hub-${input.period}-report-${filenamePeriod}.pdf`);
}

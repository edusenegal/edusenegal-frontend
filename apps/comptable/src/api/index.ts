import { createAuthApi } from '@/api/auth.api';
import { createCashSessionsApi } from '@/api/cashSessions.api';
import { createExpensesApi } from '@/api/expenses.api';
import { createLedgerApi } from '@/api/ledger.api';
import { createPaymentsApi } from '@/api/payments.api';
import { createRestoTicketsApi } from '@/api/restoTickets.api';
import { createSalaryPaymentsApi } from '@/api/salaryPayments.api';
import { createScholarshipsApi } from '@/api/scholarships.api';
import { createSchoolApi } from '@/api/school.api';
import { createStudentsApi } from '@/api/students.api';
import { createWalletApi } from '@/api/wallet.api';
import type { Services } from '@/services/ports';

/** Assemblage des services HTTP — espace comptabilité. */
export function createApiServices(): Services {
  return {
    auth: createAuthApi(),
    school: createSchoolApi(),
    expenses: createExpensesApi(),
    cashSessions: createCashSessionsApi(),
    ledger: createLedgerApi(),
    salaryPayments: createSalaryPaymentsApi(),
    students: createStudentsApi(),
    wallet: createWalletApi(),
    payments: createPaymentsApi(),
    restoTickets: createRestoTicketsApi(),
    scholarships: createScholarshipsApi(),
  };
}

import { Ban } from 'lucide-react-native';
import { ApiError } from '../api';
import { showDialog } from './Dialog';

// A banned account trying to sign in: say why and until when (in the phone's own time), instead of a vague error.
// Returns true when it handled the error.
export function showIfBanned(e: unknown) {
  if (!(e instanceof ApiError) || e.code !== 'ACCOUNT_BANNED') return false;
  const until = typeof e.data?.until === 'string' ? new Date(e.data.until) : null;
  const reason = typeof e.data?.reason === 'string' && e.data.reason ? e.data.reason : null;
  const when = until?.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const lines = [until ? `You can sign in again after ${when}.` : 'This account is banned permanently.', reason ? `Reason: ${reason}` : null];
  showDialog({
    title: 'Account banned',
    message: lines.filter(Boolean).join('\n\n'),
    Icon: Ban,
    tone: 'danger',
    actions: [{ label: 'OK', value: 'ok', kind: 'primary' }],
  });
  return true;
}

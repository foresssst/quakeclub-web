import { redirect } from 'next/navigation';

// Redirigir a /clanes/rankings que es donde está la página real
export default function RankingsClanesPage() {
  redirect('/clanes/rankings');
}

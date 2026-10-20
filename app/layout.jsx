import './globals.css';
export const metadata = {
 title: 'AstraGame — Build. Raid. Survive.',
 description: 'Un duel de survie et de construction en temps réel. Récoltez, fortifiez votre bastion et envoyez vos créatures.'
};
export default function Layout({children}) {
 return <html lang="fr"><body>{children}</body></html>;
}

import { Empty, Spinner } from '../components/ui';
import { titleCase } from '../lib/format';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="animate-fade">
      <Empty
        title={`${titleCase(title)} — next in the lift`}
        hint="The API routes are already live on the server. This screen gets built in the next pass of the React lift."
      />
    </div>
  );
}
import { useTCRView } from "../hooks";
import { formatEther } from "ethers/lib/utils";

function TCRView() {
  const data = useTCRView(process.env.REACT_APP_LIGHT_GTCR_ADDRESS);
  const errored = data && data.tcrError;

  const loading = !data || data.loading || !data.submissionDeposit;
  console.info(data);

  if (errored)
    return (
      <p style={{ maxWidth: `500px` }}>
        <code>{JSON.stringify(errored, null, 2)}</code>
      </p>
    );

  if (loading) return <p>Loading...</p>;

  return (
    <p>
      Deposit{" "}
      <code>
        {formatEther(data.submissionDeposit ? data.submissionDeposit : 0)} ETH
      </code>
    </p>
  );
}

export default TCRView;

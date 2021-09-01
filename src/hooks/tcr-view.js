import { useState, useEffect, useMemo } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers } from "ethers";
import localforage from "localforage";
import _gtcr from "../assets/abis/light-gtcr.json";
import _GTCRView from "../assets/abis/light-gtcr-view.json";
import _arbitrator from "../assets/abis/iarbitrator.json";
import { getAddress } from "ethers/lib/utils";

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const useTCRView = (tcrAddress) => {
  const { library, active, chainId } = useWeb3React();
  const [metaEvidence, setMetaEvidence] = useState();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [arbitrableTCRData, setArbitrableTCRData] = useState();
  const [arbitrationCost, setArbitrationCost] = useState();
  const [submissionDeposit, setSubmissionDeposit] = useState();
  const [submissionChallengeDeposit, setSubmissionChallengeDeposit] =
    useState();
  const [removalDeposit, setRemovalDeposit] = useState();
  const [removalChallengeDeposit, setRemovalChallengeDeposit] = useState();
  const [connectedTCRAddr, setConnectedTCRAddr] = useState();
  const [depositFor, setDepositFor] = useState();
  const [metadataByTime, setMetadataByTime] = useState();

  const arbitrableTCRViewAddr = process.env.REACT_APP_LIGHT_GTCRVIEW_ADDRESS;

  // Wire up the TCR.
  const gtcrView = useMemo(() => {
    if (!library || !active || !arbitrableTCRViewAddr || !chainId) {
      return;
    }
    try {
      return new ethers.Contract(arbitrableTCRViewAddr, _GTCRView, library);
    } catch (err) {
      console.error("Error instantiating gtcr view contract", err);
      setError("Error instantiating view contract");
    }
  }, [active, arbitrableTCRViewAddr, library, chainId]);

  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress || !chainId) return;

    try {
      // Test if address is valid (getAddress throws if it is not).
      getAddress(tcrAddress);
      return new ethers.Contract(tcrAddress, _gtcr, library);
    } catch (err) {
      console.error("Error instantiating gtcr contract", err);
      setError("Error setting up this TCR");
    }
  }, [active, library, chainId, tcrAddress]);

  const META_EVIDENCE_CACHE_KEY = useMemo(() => {
    if (!gtcr || typeof chainId === "undefined") return null;
    return `metaEvidence-${gtcr.address}@chainId-${chainId}`;
  }, [chainId, gtcr]);

  // Use cached meta evidence, if any is available.
  // It will be overwritten by the latest once it has been fetched.
  useEffect(() => {
    if (!META_EVIDENCE_CACHE_KEY) return;
    localforage
      .getItem(META_EVIDENCE_CACHE_KEY)
      .then((file) => setMetaEvidence(file))
      .catch((err) => {
        console.error("Error fetching meta evidence file from cache", err);
      });
  }, [META_EVIDENCE_CACHE_KEY]);

  // Get TCR data.
  useEffect(() => {
    if (!gtcrView || !tcrAddress) {
      return;
    }

    (async () => {
      try {
        setArbitrableTCRData({
          ...(await gtcrView.fetchArbitrable(tcrAddress)),
          tcrAddress,
        });
        setLoading(false);
      } catch (err) {
        console.error("Error fetching arbitrable TCR data:", err);
        setError("Error fetching arbitrable TCR data");
      }
    })();
  }, [gtcrView, tcrAddress]);

  // Get the current arbitration cost to calculate request and challenge deposits.
  useEffect(() => {
    (async () => {
      if (
        !arbitrableTCRData ||
        tcrAddress === depositFor ||
        (arbitrationCost && depositFor && tcrAddress === depositFor)
      ) {
        return;
      }

      try {
        // Check that both urls are valid.
        getAddress(tcrAddress);
        if (depositFor) getAddress(depositFor);
      } catch (_) {
        // No-op
        return;
      }

      try {
        const {
          arbitrator: arbitratorAddress,
          arbitratorExtraData,
          submissionBaseDeposit,
          removalBaseDeposit,
          submissionChallengeBaseDeposit,
          removalChallengeBaseDeposit,
        } = arbitrableTCRData;

        const arbitrator = new ethers.Contract(
          arbitratorAddress,
          _arbitrator,
          library
        );

        const newArbitrationCost = await arbitrator.arbitrationCost(
          arbitratorExtraData
        );

        // Submission deposit = submitter base deposit + arbitration cost
        const newSubmissionDeposit =
          submissionBaseDeposit.add(newArbitrationCost);

        // Removal deposit = removal base deposit + arbitration cost
        const newRemovalDeposit = removalBaseDeposit.add(newArbitrationCost);

        // Challenge deposit = submission challenge base deposit + arbitration cost
        const newSubmissionChallengeDeposit =
          submissionChallengeBaseDeposit.add(newArbitrationCost);

        // Challenge deposit = removal challenge base deposit + arbitration cost
        const newRemovalChallengeDeposit =
          removalChallengeBaseDeposit.add(newArbitrationCost);

        setArbitrationCost(newArbitrationCost);
        setSubmissionDeposit(newSubmissionDeposit);
        setSubmissionChallengeDeposit(newSubmissionChallengeDeposit);
        setRemovalDeposit(newRemovalDeposit);
        setRemovalChallengeDeposit(newRemovalChallengeDeposit);
        setDepositFor(arbitrableTCRData.tcrAddress);
      } catch (err) {
        console.error("Error computing arbitration cost:", err);
        if (err.message === "header not found" && arbitrationCost)
          // No-op, arbitration cost was already set when metamask threw.
          return;

        setError("Error computing arbitration cost");
      }
    })();
  }, [arbitrableTCRData, arbitrationCost, depositFor, library, tcrAddress]);

  // Fetch meta evidence.
  useEffect(() => {
    if (
      !gtcr ||
      !library ||
      gtcr.address !== tcrAddress ||
      (metaEvidence && metaEvidence.address === tcrAddress)
    ) {
      return;
    }
    (async () => {
      try {
        // Take the latest meta evidence.
        const logs = (
          await library.getLogs({
            ...gtcr.filters.MetaEvidence(),
            fromBlock: 0,
          })
        ).map((log) => ({ ...log, ...gtcr.interface.parseLog(log) }));
        if (logs.length === 0) return;

        const metaEvidenceFiles = await Promise.all(
          logs.map(async (log) => {
            try {
              const { args, blockNumber } = log;
              const { _evidence: metaEvidencePath } = args;

              const [response, block] = await Promise.all([
                fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath),
                library.getBlock(blockNumber),
              ]);

              const file = await response.json();

              return {
                ...file,
                address: tcrAddress,
                timestamp: block.timestamp,
                blockNumber,
              };
            } catch (err) {
              console.error("Failed to process meta evidence", err);
              setError(err);
              return { err };
            }
          })
        );

        const metadataTime = {
          byBlockNumber: {},
          byTimestamp: {},
          address: logs[0].address,
        };
        metaEvidenceFiles.forEach((file) => {
          if (file.error) return;
          metadataTime.byBlockNumber[file.blockNumber] = file;
          metadataTime.byTimestamp[file.timestamp] = file;
        });
        setMetadataByTime(metadataTime);

        // Take the penultimate item. This is the most recent meta evidence
        // for registration requests.
        const file = metaEvidenceFiles[metaEvidenceFiles.length - 2];
        setMetaEvidence({ ...file, address: tcrAddress });
        localforage.setItem(META_EVIDENCE_CACHE_KEY, file);
      } catch (err) {
        console.error("Error fetching meta evidence", err);
        setError("Error fetching meta evidence");
      }
    })();

    return () => {
      gtcr.removeAllListeners(gtcr.filters.MetaEvidence());
    };
  }, [META_EVIDENCE_CACHE_KEY, gtcr, library, metaEvidence, tcrAddress]);

  // Fetch the Related TCR address
  useEffect(() => {
    if (!gtcr || !library || gtcr.address !== tcrAddress) return;
    (async () => {
      try {
        const logs = (
          await library.getLogs({
            ...gtcr.filters.ConnectedTCRSet(),
            fromBlock: 0,
          })
        ).map((log) => gtcr.interface.parseLog(log));
        if (logs.length === 0) return;

        setConnectedTCRAddr(logs[logs.length - 1].args._connectedTCR);
      } catch (error) {
        console.error(error);
        setError(error);
      }
    })();
  }, [gtcr, library, connectedTCRAddr, tcrAddress]);

  return {
    gtcr,
    metaEvidence,
    tcrError: error,
    arbitrationCost,
    submissionDeposit,
    submissionChallengeDeposit,
    removalDeposit,
    removalChallengeDeposit,
    tcrAddress,
    gtcrView,
    connectedTCRAddr,
    metadataByTime,
    loading,
    ...arbitrableTCRData,
  };
};

export default useTCRView;

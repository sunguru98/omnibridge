import { Web3Context } from 'contexts/Web3Context';
import { BigNumber } from 'ethers';
import { LARGEST_UINT256, LOCAL_STORAGE_KEYS } from 'lib/constants';
import { logError } from 'lib/helpers';
import { approveToken, fetchAllowance } from 'lib/token';
import { useCallback, useContext, useEffect, useState } from 'react';

const { INFINITE_UNLOCK } = LOCAL_STORAGE_KEYS;

export const useApproval = (fromToken, fromAmount) => {
  const { account, ethersProvider, providerChainId } = useContext(Web3Context);
  const [allowance, setAllowance] = useState(BigNumber.from(0));
  const [trigger, shouldTrigger] = useState(false);
  const updateAllowance = () => shouldTrigger(u => !u);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (fromToken && providerChainId === fromToken.chainId) {
      fetchAllowance(fromToken, account, ethersProvider).then(setAllowance);
    }
  }, [ethersProvider, account, fromToken, providerChainId, trigger]);

  useEffect(() => {
    setAllowed(
      (fromToken && fromToken.mode === 'erc677') || allowance.gte(fromAmount),
    );
  }, [fromAmount, allowance, fromToken]);

  const [unlockLoading, setUnlockLoading] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState();

  const approve = useCallback(async () => {
    setUnlockLoading(true);
    const approvalAmount =
      window.localStorage.getItem(INFINITE_UNLOCK) === 'true'
        ? LARGEST_UINT256
        : fromAmount;
    try {
      const tx = await approveToken(ethersProvider, fromToken, approvalAmount);
      setApprovalTxHash(tx.hash);
      await tx.wait();
      setAllowance(approvalAmount);
    } catch (approveError) {
      logError({
        approveError,
        fromToken,
        approvalAmount: approvalAmount.toString(),
        account,
      });
      throw approveError;
    } finally {
      setApprovalTxHash();
      setUnlockLoading(false);
    }
  }, [fromAmount, fromToken, ethersProvider, account]);

  return { allowed, updateAllowance, unlockLoading, approvalTxHash, approve };
};

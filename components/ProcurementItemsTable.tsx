import ProcurementItemsTableClient, {
  ProcurementItemGroup,
  ProcurementTablePermissions,
} from './ProcurementItemsTableClient';
import {
  requestTopUpForItem,
  approveTopUpRequest,
  requestItemReview,
  approveItemReview,
  rejectItemReview,
  updateRequisitionItemUnitPrice,
} from '@/app/(protected)/projects/actions';

type Props = {
  grouped: ProcurementItemGroup[];
  permissions: ProcurementTablePermissions;
  currency: string;
  showTopUps?: boolean;
  showVariance?: boolean;
  unitPriceFormIds?: string[];
  showReviewControls?: boolean;
  reviewFlagFormIds?: string[];
  readOnly?: boolean;
};

export default function ProcurementItemsTable({
  showTopUps = true,
  showVariance = true,
  unitPriceFormIds,
  showReviewControls = true,
  reviewFlagFormIds,
  readOnly = false,
  hideFinancials = false,
  ...props
}: Props & { hideFinancials?: boolean }) {
  return (
    <ProcurementItemsTableClient
      {...props}
      showTopUps={showTopUps}
      showVariance={showVariance}
      unitPriceFormIds={unitPriceFormIds}
      showReviewControls={showReviewControls}
      reviewFlagFormIds={reviewFlagFormIds}
      readOnly={readOnly}
      hideFinancials={hideFinancials}
      actions={{
        requestTopUpForItem,
        approveTopUpRequest,
        requestItemReview,
        approveItemReview,
        rejectItemReview,
        updateRequisitionItemUnitPrice,
      }}
    />
  );
}

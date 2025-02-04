import getTopLevelOperations, {
	ServiceDataProps,
} from 'api/metrics/getTopLevelOperations';
import { ActiveElement, Chart, ChartData, ChartEvent } from 'chart.js';
import { FeatureKeys } from 'constants/features';
import { QueryParams } from 'constants/query';
import { PANEL_TYPES } from 'constants/queryBuilder';
import ROUTES from 'constants/routes';
import { routeConfig } from 'container/SideNav/config';
import { getQueryString } from 'container/SideNav/helper';
import useFeatureFlag from 'hooks/useFeatureFlag';
import useResourceAttribute from 'hooks/useResourceAttribute';
import {
	convertRawQueriesToTraceSelectedTags,
	resourceAttributesToTagFilterItems,
} from 'hooks/useResourceAttribute/utils';
import history from 'lib/history';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useParams } from 'react-router-dom';
import { UpdateTimeInterval } from 'store/actions';
import { AppState } from 'store/reducers';
import { EQueryType } from 'types/common/dashboard';
import { GlobalReducer } from 'types/reducer/globalTime';
import { Tags } from 'types/reducer/trace';
import { v4 as uuid } from 'uuid';

import { GraphTitle } from '../constant';
import { getWidgetQueryBuilder } from '../MetricsApplication.factory';
import {
	errorPercentage,
	operationPerSec,
} from '../MetricsPageQueries/OverviewQueries';
import { Card, Col, Row } from '../styles';
import ServiceOverview from './Overview/ServiceOverview';
import TopLevelOperation from './Overview/TopLevelOperations';
import TopOperation from './Overview/TopOperation';
import TopOperationMetrics from './Overview/TopOperationMetrics';
import { Button } from './styles';
import { IServiceName } from './types';
import {
	handleNonInQueryRange,
	onGraphClickHandler,
	onViewTracePopupClick,
} from './util';

function Application(): JSX.Element {
	const { maxTime, minTime } = useSelector<AppState, GlobalReducer>(
		(state) => state.globalTime,
	);
	const { servicename } = useParams<IServiceName>();
	const [selectedTimeStamp, setSelectedTimeStamp] = useState<number>(0);
	const { search } = useLocation();
	const { queries } = useResourceAttribute();
	const selectedTags = useMemo(
		() => (convertRawQueriesToTraceSelectedTags(queries) as Tags[]) || [],
		[queries],
	);
	const isSpanMetricEnabled = useFeatureFlag(FeatureKeys.USE_SPAN_METRICS)
		?.active;

	const handleSetTimeStamp = useCallback((selectTime: number) => {
		setSelectedTimeStamp(selectTime);
	}, []);

	const dispatch = useDispatch();
	const handleGraphClick = useCallback(
		(type: string): ClickHandlerType => (
			ChartEvent: ChartEvent,
			activeElements: ActiveElement[],
			chart: Chart,
			data: ChartData,
		): void => {
			onGraphClickHandler(handleSetTimeStamp)(
				ChartEvent,
				activeElements,
				chart,
				data,
				type,
			);
		},
		[handleSetTimeStamp],
	);

	const {
		data: topLevelOperations,
		isLoading: topLevelOperationsLoading,
		error: topLevelOperationsError,
		isError: topLevelOperationsIsError,
	} = useQuery<ServiceDataProps>({
		queryKey: [servicename, minTime, maxTime, selectedTags],
		queryFn: getTopLevelOperations,
	});

	const selectedTraceTags: string = JSON.stringify(
		convertRawQueriesToTraceSelectedTags(queries) || [],
	);

	const tagFilterItems = useMemo(
		() =>
			handleNonInQueryRange(resourceAttributesToTagFilterItems(queries)) || [],
		[queries],
	);

	const topLevelOperationsRoute = useMemo(
		() => (topLevelOperations ? topLevelOperations[servicename || ''] : []),
		[servicename, topLevelOperations],
	);

	const operationPerSecWidget = useMemo(
		() =>
			getWidgetQueryBuilder({
				query: {
					queryType: EQueryType.QUERY_BUILDER,
					promql: [],
					builder: operationPerSec({
						servicename,
						tagFilterItems,
						topLevelOperations: topLevelOperationsRoute,
					}),
					clickhouse_sql: [],
					id: uuid(),
				},
				title: GraphTitle.RATE_PER_OPS,
				panelTypes: PANEL_TYPES.TIME_SERIES,
			}),
		[servicename, tagFilterItems, topLevelOperationsRoute],
	);

	const errorPercentageWidget = useMemo(
		() =>
			getWidgetQueryBuilder({
				query: {
					queryType: EQueryType.QUERY_BUILDER,
					promql: [],
					builder: errorPercentage({
						servicename,
						tagFilterItems,
						topLevelOperations: topLevelOperationsRoute,
					}),
					clickhouse_sql: [],
					id: uuid(),
				},
				title: GraphTitle.ERROR_PERCENTAGE,
				panelTypes: PANEL_TYPES.TIME_SERIES,
			}),
		[servicename, tagFilterItems, topLevelOperationsRoute],
	);

	const onDragSelect = useCallback(
		(start: number, end: number) => {
			const startTimestamp = Math.trunc(start);
			const endTimestamp = Math.trunc(end);

			if (startTimestamp !== endTimestamp) {
				dispatch(UpdateTimeInterval('custom', [startTimestamp, endTimestamp]));
			}
		},
		[dispatch],
	);

	const onErrorTrackHandler = (timestamp: number): void => {
		const currentTime = timestamp;
		const tPlusOne = timestamp + 60 * 1000;

		const urlParams = new URLSearchParams(search);
		urlParams.set(QueryParams.startTime, currentTime.toString());
		urlParams.set(QueryParams.endTime, tPlusOne.toString());

		const avialableParams = routeConfig[ROUTES.TRACE];
		const queryString = getQueryString(avialableParams, urlParams);

		history.replace(
			`${
				ROUTES.TRACE
			}?selected={"serviceName":["${servicename}"],"status":["error"]}&filterToFetchData=["duration","status","serviceName"]&spanAggregateCurrentPage=1&selectedTags=${selectedTraceTags}&isFilterExclude={"serviceName":false,"status":false}&userSelectedFilter={"serviceName":["${servicename}"],"status":["error"]}&spanAggregateCurrentPage=1&${queryString.join(
				'',
			)}`,
		);
	};

	return (
		<>
			<Row gutter={24}>
				<Col span={12}>
					<ServiceOverview
						onDragSelect={onDragSelect}
						handleGraphClick={handleGraphClick}
						selectedTimeStamp={selectedTimeStamp}
						selectedTraceTags={selectedTraceTags}
						topLevelOperationsRoute={topLevelOperationsRoute}
					/>
				</Col>

				<Col span={12}>
					<Button
						type="default"
						size="small"
						id="Rate_button"
						onClick={onViewTracePopupClick({
							servicename,
							selectedTraceTags,
							timestamp: selectedTimeStamp,
						})}
					>
						View Traces
					</Button>
					<TopLevelOperation
						handleGraphClick={handleGraphClick}
						onDragSelect={onDragSelect}
						topLevelOperationsError={topLevelOperationsError}
						topLevelOperationsLoading={topLevelOperationsLoading}
						topLevelOperationsIsError={topLevelOperationsIsError}
						name="operations_per_sec"
						widget={operationPerSecWidget}
						yAxisUnit="ops"
						opName="Rate"
					/>
				</Col>
			</Row>
			<Row gutter={24}>
				<Col span={12}>
					<Button
						type="default"
						size="small"
						id="Error_button"
						onClick={(): void => {
							onErrorTrackHandler(selectedTimeStamp);
						}}
					>
						View Traces
					</Button>

					<TopLevelOperation
						handleGraphClick={handleGraphClick}
						onDragSelect={onDragSelect}
						topLevelOperationsError={topLevelOperationsError}
						topLevelOperationsLoading={topLevelOperationsLoading}
						topLevelOperationsIsError={topLevelOperationsIsError}
						name="error_percentage_%"
						widget={errorPercentageWidget}
						yAxisUnit="%"
						opName="Error"
					/>
				</Col>

				<Col span={12}>
					<Card>
						{isSpanMetricEnabled ? <TopOperationMetrics /> : <TopOperation />}
					</Card>
				</Col>
			</Row>
		</>
	);
}

export type ClickHandlerType = (
	ChartEvent: ChartEvent,
	activeElements: ActiveElement[],
	chart: Chart,
	data: ChartData,
	type?: string,
) => void;

export default Application;

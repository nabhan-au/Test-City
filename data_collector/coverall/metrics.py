class MetricsManager:
    def __init__(self, relative_filename):
        self.relative_filename = relative_filename
        self.file_coverage = None
        self.add_count = None
        self.avg_trace = None
        self.num_line = None

    def extract_trace_metrics(self, trace_list):
        sum_trace = 0
        line = 0
        not_zero = 0
        for trace in trace_list:
            if trace is not None:
                sum_trace += trace
                line += 1
                if trace != 0:
                    not_zero += 1
        self.file_coverage = 100 * float(not_zero) / line
        self.add_count = 1
        self.avg_trace = float(sum_trace) / line

    def add_loc_data(self, file):
        # 行数
        self.num_line = file.nloc  # コメント，空白なし

    @classmethod
    def create_instance(cls, filename, dict):
        metrics = MetricsManager(filename)
        metrics.file_coverage = dict["file_coverage"]
        metrics.add_count = dict["add_count"]
        metrics.avg_trace = dict["avg_trace"]
        metrics.num_line = dict["num_line"]
        return metrics

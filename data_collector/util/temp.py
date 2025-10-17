import os
import glob
import subprocess
from collections import defaultdict

def run_command(cmd, cwd):
    try:
        result = subprocess.run(
            cmd, cwd=cwd, shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, check=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stdout


def run_tests(project_path):
    project_name = os.path.basename(project_path)
    print(f"Running PIT on {project_name}...")
    ok, out = run_command(
        'mvn -B test-compile org.pitest:pitest-maven:mutationCoverage -DwithHistory -DoutputFormats=HTML,XML,CSV -DexportLineCoverage=true -Dthreads=6 -DargLine="-Xmx6G"',
        project_path
    )
    return ok

if __name__ == "__main__":
    folder = "/Users/nabhansuwanachote/Desktop/code/code-is-beautiful-dataset-2"

    # folder_list = os.listdir(folder)
    # for index, i in enumerate(folder_list):
    #     # if index <= 6:
    #     #     print("Skip: " + i)
    #     #     continue
    #     if "apollo" == i or i == "java" or i == ".DS_Store":
    #         print("Skip: " + i)
    #         continue
    #     run_tests(os.path.join(folder, i))

    # Find all pit-reports folders recursively
    pit_dirs = glob.glob(f"{folder}/**/pit-reports", recursive=True)

    project_counts = defaultdict(int)

    for pit_dir in pit_dirs:
        if os.path.isdir(pit_dir):
            # The project name = first-level folder under dataset
            rel_path = os.path.relpath(pit_dir, folder)
            project = rel_path.split(os.sep)[0]

            # Count files inside this pit-reports folder
            file_count = sum(len(files) for _, _, files in os.walk(pit_dir))
            project_counts[project] += file_count

    # Print result per project
    for project, count in sorted(project_counts.items()):
        print(f"{project}: {count} files")

    # Print grand total
    total_files = sum(project_counts.values())
    print(f"\nTotal PIT report files across all projects: {total_files}")

# file_counts = glob.glob(
#     "/Users/nabhansuwanachote/Desktop/code/code-is-beautiful-dataset/apollo/**/*.java",
#     recursive=True
# )
# print(len(file_counts))
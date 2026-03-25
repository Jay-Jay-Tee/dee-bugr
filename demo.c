// demo.c — Lucid Debugger Demo Program
// Compile: gcc -g -O0 -o demo demo.c
//
// Bug 1 (line 35): null pointer dereference — traverse() called with NULL node
// Bug 2 (line 47): off-by-one — loop runs depth+1 times instead of depth
//
// Demo flow:
//   1. Set breakpoint on line 35 (traverse call)
//   2. Run → anomaly detection fires automatically: "node is null"
//   3. Show object graph of root (linked tree structure)
//   4. Explain Bug → AI explains the null dereference
//   5. Suggest Fix → accept 3-line diff
//   6. Show memory view of the null pointer (0x0000000000000000)
//   7. Open assembly → see MOV instruction that dereferences null

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Node {
    int value;
    struct Node* left;
    struct Node* right;
} Node;

Node* createNode(int value) {
    Node* n = (Node*)malloc(sizeof(Node));
    if (!n) { fprintf(stderr, "malloc failed\n"); exit(1); }
    n->value = value;
    n->left  = NULL;
    n->right = NULL;
    return n;
}

// BUG: no null check — will crash when node == NULL
void traverse(Node* node, int depth) {
    if (depth <= 0) return;
    printf("Node value: %d\n", node->value);  // line 35 — CRASH if node is NULL
    traverse(node->left,  depth - 1);
    traverse(node->right, depth - 1);
}

// Off-by-one: should be i < depth, not i <= depth
void printValues(int* arr, int depth) {
    for (int i = 0; i <= depth; i++) {   // line 42 — runs one too many times
        printf("arr[%d] = %d\n", i, arr[i]);
    }
}

int main() {
    // Build a tree: root(10) → left(5), right is NULL
    Node* root   = createNode(10);
    root->left   = createNode(5);
    root->right  = NULL;  // intentionally missing right child

    int arr[] = {1, 2, 3, 4, 5};
    int depth = 4;

    printf("Starting traversal...\n");
    traverse(root, depth);    // will crash: right subtree goes to NULL node

    printf("Printing array...\n");
    printValues(arr, depth);  // off-by-one: reads arr[5] (out of bounds)

    // Cleanup
    free(root->left);
    free(root);

    return 0;
}

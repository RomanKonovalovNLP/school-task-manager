import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FilterCategory } from '../../types';

interface FiltersState {
    categories: FilterCategory[];
    loading: boolean;
    error: string | null;
}

const initialState: FiltersState = {
    categories: [],
    loading: false,
    error: null,
};

const filtersSlice = createSlice({
    name: 'filters',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setCategories: (state, action: PayloadAction<FilterCategory[]>) => {
            state.categories = action.payload;
            state.loading = false;
            state.error = null;
        },
        addCategory: (state, action: PayloadAction<FilterCategory>) => {
            state.categories.push(action.payload);
        },
        removeCategory: (state, action: PayloadAction<number>) => {
            state.categories = state.categories.filter((c) => c.id !== action.payload);
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
            state.loading = false;
        },
    },
});

export const {
    setLoading,
    setCategories,
    addCategory,
    removeCategory,
    setError,
} = filtersSlice.actions;

export default filtersSlice.reducer;